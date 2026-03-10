import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { generateCustomerActions, linkSubmissionToDocument } from '@/app/lib/customer/actionGenerator'

export async function POST(request: NextRequest) {
  try {
    const { submission_id } = await request.json()

    if (!submission_id) {
      return NextResponse.json({ error: 'submission_id is required' }, { status: 400 })
    }

    // Fetch the submission
    const { data: sub, error: subError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submission_id)
      .single()

    if (subError || !sub) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // ── FA form type: parse notes for structured data ──
    const isFA = sub.form_type === 'fa_apparel' || sub.form_type === 'fa_embroidery'
    let faParsed: Record<string, string> = {}
    if (isFA && sub.notes) {
      const parts = sub.notes.includes('|') ? sub.notes.split('|') : sub.notes.split('\n')
      for (const part of parts) {
        const trimmed = part.trim()
        const colonIdx = trimmed.indexOf(':')
        if (colonIdx > 0) {
          const key = trimmed.slice(0, colonIdx).trim().toLowerCase()
          const value = trimmed.slice(colonIdx + 1).trim()
          if (value) faParsed[key] = value
        }
      }
    }

    // Build vehicle description — prefer new vehicles array
    let vehicleDescription = ''
    if (isFA) {
      const style = faParsed['style #'] || faParsed['style'] || ''
      const color = faParsed['color'] || ''
      vehicleDescription = [style, color].filter(Boolean).join(' — ')
        || (sub.form_type === 'fa_embroidery' ? 'FA Embroidery' : 'FA Apparel')
    } else if (sub.vehicles && Array.isArray(sub.vehicles) && sub.vehicles.length > 0) {
      vehicleDescription = sub.vehicles.map((v: { type_label?: string; year?: string; make?: string; model?: string; is_other?: boolean; other_desc?: string }) => {
        if (v.is_other) return v.other_desc || v.type_label || 'Other'
        const parts = [v.year, v.make, v.model].filter(Boolean).join(' ')
        return parts || v.type_label || 'Vehicle'
      }).join('; ')
      if (sub.vehicles.length > 1) {
        vehicleDescription = `${sub.vehicles.length} vehicles: ${vehicleDescription}`
      }
    } else {
      const vehicleParts = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean)
      vehicleDescription = vehicleParts.join(' ')
      if (sub.vehicle_count && sub.vehicle_count > 1) {
        vehicleDescription += ` (x${sub.vehicle_count})`
      }
    }

    // Build project description — prefer new form fields
    const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    let projectDescription = ''
    if (isFA) {
      const sizesRaw = faParsed['sizes'] || ''
      const totalQty = faParsed['total qty'] || faParsed['qty'] || ''
      // Format sizes: parse JSON object like {"M":2,"L":3} into "M:2, L:3"
      let sizesFormatted = sizesRaw
      if (sizesRaw.startsWith('{')) {
        try {
          const obj = JSON.parse(sizesRaw) as Record<string, number>
          sizesFormatted = Object.entries(obj)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}:${v}`)
            .join(', ')
        } catch { /* use raw string as fallback */ }
      }
      const descParts: string[] = []
      if (sizesFormatted) descParts.push(sizesFormatted)
      if (totalQty) descParts.push(`Total: ${totalQty} pcs`)
      projectDescription = descParts.join(' — ') || (sub.form_type === 'fa_embroidery' ? 'Embroidery Request' : 'Apparel Request')
    } else {
      const projectParts = []
      if (sub.coverage_type) {
        projectParts.push(titleCase(sub.coverage_type))
      } else if (sub.project_type) {
        projectParts.push(titleCase(sub.project_type))
      }
      if (sub.artwork_status) {
        projectParts.push(titleCase(sub.artwork_status))
      } else if (sub.design_scenario) {
        projectParts.push(titleCase(sub.design_scenario))
      }
      projectDescription = projectParts.join(' - ')
    }

    // Build notes from available info
    let notesText = ''
    if (isFA) {
      // Pass through full notes as-is so nothing is lost
      notesText = sub.notes || ''
    } else {
      const notesParts = []
      if (sub.additional_info) notesParts.push(sub.additional_info)
      if (sub.vision_description) notesParts.push(sub.vision_description)
      notesText = notesParts.join('\n\n')
    }

    // Find or create customer
    let customerId = null
    if (sub.customer_email) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('email', sub.customer_email)
        .limit(1)
        .single()

      if (existing) {
        customerId = existing.id
      }
    }

    if (!customerId && sub.customer_phone) {
      const phone = sub.customer_phone.replace(/\D/g, '').slice(-10)
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .ilike('phone', `%${phone}`)
        .limit(1)
        .single()

      if (existing) {
        customerId = existing.id
      }
    }

    // Create customer if no existing match
    if (!customerId && (sub.customer_email || sub.customer_phone)) {
      const nameParts = (sub.customer_name || '').trim().split(/\s+/)
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''
      const phone = sub.customer_phone ? sub.customer_phone.replace(/\D/g, '').slice(-10) : null

      const { data: newCustomer } = await supabase
        .from('customers')
        .insert({
          first_name: firstName,
          last_name: lastName,
          display_name: sub.customer_name || '',
          email: sub.customer_email || null,
          phone: phone,
          company: sub.company_name || null,
          source: 'website_form',
        })
        .select('id')
        .single()

      if (newCustomer) {
        customerId = newCustomer.id
      }
    }

    // Get next doc_number
    const { data: maxDoc } = await supabase
      .from('documents')
      .select('doc_number')
      .order('doc_number', { ascending: false })
      .limit(1)
      .single()

    const nextDocNumber = Math.max((maxDoc?.doc_number || 0) + 1, 1001)

    // Create the quote document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        doc_number: nextDocNumber,
        doc_type: 'quote',
        status: 'draft',
        bucket: 'READY_FOR_ACTION',
        customer_name: sub.customer_name || '',
        customer_email: sub.customer_email || '',
        customer_phone: sub.customer_phone || '',
        company_name: sub.company_name || '',
        customer_id: customerId,
        vehicle_description: vehicleDescription,
        project_description: projectDescription,
        notes: notesText || '',
        submission_id: sub.id,
      })
      .select('id, doc_number')
      .single()

    if (docError) {
      console.error('Document creation error:', docError)
      return NextResponse.json({ error: docError.message }, { status: 500 })
    }

    // ── FA: attach artwork files to the quote if present ──
    // Check notes field, logo_urls column, and reference_image_urls column
    if (isFA) {
      const guessContentType = (url: string): string => {
        const lower = url.toLowerCase().split('?')[0]
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
        if (lower.endsWith('.png')) return 'image/png'
        if (lower.endsWith('.svg')) return 'image/svg+xml'
        if (lower.endsWith('.gif')) return 'image/gif'
        if (lower.endsWith('.webp')) return 'image/webp'
        if (lower.endsWith('.pdf')) return 'application/pdf'
        return 'application/octet-stream'
      }
      const extractFilename = (url: string): string => {
        try {
          const path = new URL(url).pathname
          const name = path.split('/').pop() || ''
          return decodeURIComponent(name) || 'file'
        } catch {
          return url.split('/').pop()?.split('?')[0] || 'file'
        }
      }
      const buildAttachment = (url: string, label: string) => ({
        url,
        thumbnail_url: url,
        key: '',
        filename: extractFilename(url),
        contentType: guessContentType(url),
        size: 0,
        uploadedAt: new Date().toISOString(),
        label,
      })

      const attachments: ReturnType<typeof buildAttachment>[] = []
      // From notes field
      const artworkUrl = faParsed['artwork url'] || faParsed['artwork'] || ''
      if (artworkUrl) {
        attachments.push(buildAttachment(artworkUrl, 'Customer Artwork'))
      }
      // From logo_urls column
      if (Array.isArray(sub.logo_urls)) {
        for (const url of sub.logo_urls) {
          if (url) attachments.push(buildAttachment(url, 'Customer Artwork'))
        }
      }
      // From reference_image_urls column
      if (Array.isArray(sub.reference_image_urls)) {
        for (const url of sub.reference_image_urls) {
          if (url) attachments.push(buildAttachment(url, 'Reference Image'))
        }
      }
      if (attachments.length > 0) {
        await supabase
          .from('documents')
          .update({ attachments })
          .eq('id', doc.id)
      }
    }

    // Update the submission to mark as converted
    await supabase
      .from('submissions')
      .update({
        status: 'converted',
        converted_to_quote_id: doc.id
      })
      .eq('id', submission_id)

    // Generate customer workflow actions for the new document
    // Uses the submission's project_type as the category, with 'draft' as current status
    // so REVIEW_AND_CATEGORIZE auto-completes (since review is done by converting)
    const category = isFA
      ? (sub.form_type === 'fa_embroidery' ? 'EMBROIDERY' : 'APPAREL')
      : (sub.coverage_type || sub.project_type || 'OTHER')
    await linkSubmissionToDocument(submission_id, doc.id, category).catch(err => {
      console.error('Failed to generate customer actions:', err)
      // Non-blocking - don't fail the conversion if action generation fails
    })

    return NextResponse.json({
      ok: true,
      doc_id: doc.id,
      doc_number: doc.doc_number
    })
  } catch (error) {
    console.error('Convert submission error:', error)
    return NextResponse.json({ error: 'Failed to convert submission' }, { status: 500 })
  }
}
