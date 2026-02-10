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

    // Build vehicle description
    const vehicleParts = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean)
    let vehicleDescription = vehicleParts.join(' ')
    if (sub.vehicle_count && sub.vehicle_count > 1) {
      vehicleDescription += ` (x${sub.vehicle_count})`
    }

    // Build project description
    const projectParts = []
    if (sub.project_type) {
      projectParts.push(sub.project_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))
    }
    if (sub.design_scenario) {
      projectParts.push(sub.design_scenario.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))
    }
    const projectDescription = projectParts.join(' - ')

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
        notes: sub.vision_description || '',
        submission_id: sub.id,
      })
      .select('id, doc_number')
      .single()

    if (docError) {
      console.error('Document creation error:', docError)
      return NextResponse.json({ error: docError.message }, { status: 500 })
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
    const category = sub.project_type || 'OTHER'
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
