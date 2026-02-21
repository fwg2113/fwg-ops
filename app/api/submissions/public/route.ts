import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { generateSubmissionAction } from '@/app/lib/customer/actionGenerator'

// ─── CORS headers for cross-origin Shopify requests ───
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// ─── Coverage → category mapping ───
// Maps the form's coverage_type values to ops category keys
// so the customer workflow system can generate the right actions.
const COVERAGE_TO_CATEGORY: Record<string, string> = {
  full_wrap: 'FULL_WRAP',
  partial_wrap: 'PARTIAL_WRAP',
  graphics_lettering: 'LETTERING',
  not_sure: 'OTHER',
}

// ─── Normalise an email value: coerce to string, strip invisible
// characters (zero-width spaces, BOM, non-breaking spaces), trim, and
// lower-case.  Returns empty string when the input is falsy. ───
function normalizeEmail(raw: unknown): string {
  if (!raw) return ''
  return String(raw)
    .trim()
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u200E\u200F]/g, '') // invisible / directional chars
    .replace(/\s+/g, '')  // collapse any remaining whitespace (shouldn't be in emails)
    .toLowerCase()
}

// ─── Main handler ───
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const formType = String(body.form_type || body.formType || 'commercial_wrap').trim().toLowerCase()

    // ── Resolve email from whichever field the form sends ──
    // Some form versions use "email", others may use "customer_email" or "contact_email".
    const rawEmail = body.email ?? body.customer_email ?? body.contact_email ?? ''
    body.email = normalizeEmail(rawEmail)

    // Sanitize other string inputs
    if (body.phone) body.phone = String(body.phone).trim()
    if (body.contact_name) body.contact_name = String(body.contact_name).trim()
    if (body.business_name) body.business_name = String(body.business_name).trim()

    // Also resolve contact_name from alternate field names
    if (!body.contact_name && body.customer_name) {
      body.contact_name = String(body.customer_name).trim()
    }

    console.log(`[${formType}] submission received — keys: ${Object.keys(body).join(', ')}, email: ${JSON.stringify(body.email)}`)

    // ── Validate required fields (varies by form type) ──
    const REQUIRED_BY_FORM_TYPE: Record<string, string[]> = {
      commercial_wrap: ['business_name', 'contact_name', 'email', 'phone', 'contact_method', 'coverage_type', 'artwork_status', 'timeline'],
      automotive_styling: ['contact_name', 'email', 'phone', 'contact_method', 'timeline'],
      ppf: ['contact_name', 'email', 'phone', 'contact_method', 'ppf_package', 'timeline'],
    }
    const required = REQUIRED_BY_FORM_TYPE[formType] || REQUIRED_BY_FORM_TYPE.commercial_wrap
    const missing = required.filter(f => !body[f])
    if (missing.length > 0) {
      console.error(`Missing required fields [${formType}]:`, missing, '| Received keys:', Object.keys(body), '| Body:', JSON.stringify(body).slice(0, 500))
      return NextResponse.json(
        { error: 'Missing required fields', fields: missing },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // ── Basic email validation ──
    // Lenient regex: local@domain.tld — allows + tags, dots, hyphens, etc.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) {
      console.error(`Invalid email [${formType}]:`, JSON.stringify(body.email), '| raw:', JSON.stringify(rawEmail), '| Body:', JSON.stringify(body).slice(0, 500))
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // ── Get next submission_number ──
    const { data: maxSub } = await supabase
      .from('submissions')
      .select('submission_number')
      .order('submission_number', { ascending: false })
      .limit(1)
      .single()

    const nextNumber = Math.max((maxSub?.submission_number || 0) + 1, 1)

    // ── Build the vehicle description for the legacy single-vehicle fields ──
    // Uses the first vehicle for backwards compatibility with existing views
    const vehicles = body.vehicles || []
    const firstVehicle = vehicles[0] || {}
    const vehicleYear = firstVehicle.year || ''
    const vehicleMake = firstVehicle.make || ''
    const vehicleModel = firstVehicle.model || ''
    const vehicleCategory = firstVehicle.type || ''

    // ── Map artwork_status to design_scenario for legacy compat ──
    const ARTWORK_TO_DESIGN: Record<string, string> = {
      fleet_match: 'FLEET_MATCH',
      print_ready: 'PRINT_READY',
      logo_vision: 'LOGO_VISION',
      logo_only: 'LOGO_ONLY',
      from_scratch: 'FROM_SCRATCH',
      ai_mockup: 'FROM_SCRATCH',
    }

    // ── Insert submission ──
    const { data: submission, error: insertError } = await supabase
      .from('submissions')
      .insert({
        submission_number: nextNumber,
        status: 'new',
        source: 'website_form',
        form_type: formType,

        // Contact info (mapped to existing columns)
        customer_name: body.contact_name,
        customer_email: body.email,
        customer_phone: body.phone,
        company_name: body.business_name || null,
        preferred_contact: body.contact_method,

        // Legacy single-vehicle fields (first vehicle for backward compat)
        vehicle_category: vehicleCategory,
        vehicle_year: vehicleYear,
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_count: vehicles.length || 1,

        // Legacy project fields
        project_type: (body.coverage_type || '').toUpperCase().replace(/ /g, '_'),
        design_scenario: ARTWORK_TO_DESIGN[body.artwork_status] || '',
        timeline: body.timeline,
        budget_range: body.budget || null,

        // ── New form-specific columns ──
        vehicles: vehicles,
        coverage_type: body.coverage_type || null,
        artwork_status: body.artwork_status || null,
        ai_acknowledged: body.ai_acknowledged || false,
        logo_urls: body.logo_urls || [],
        budget: body.budget || null,
        additional_info: body.additional_info || null,
        source_page: body.source_page || null,
        user_agent: body.user_agent || null,

        // ── Styling-form-specific columns ──
        services: body.services || [],
        service_details: formType === 'ppf'
          ? {
              ppf_film_color: body.ppf_film_color || null,
              ppf_film_color_other: body.ppf_film_color_other || null,
              ppf_colored_description: body.ppf_colored_description || null,
              ppf_colored_inspo_urls: body.ppf_colored_inspo_urls || null,
            }
          : (body.service_details || {}),
        reference_image_urls: body.reference_image_urls || [],

        // ── PPF-form-specific columns ──
        ppf_package: body.ppf_package || null,
        ppf_finish: body.ppf_finish || null,
        addons: body.addons || null,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Submission insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save submission' },
        { status: 500, headers: CORS_HEADERS }
      )
    }

    // ── Generate initial customer action (Review & Categorize) ──
    const category = COVERAGE_TO_CATEGORY[body.coverage_type] || 'OTHER'
    await generateSubmissionAction(submission.id, category).catch(err => {
      console.error('Failed to generate submission action:', err)
      // Non-blocking — submission is saved either way
    })

    // ── Send notification email (non-blocking) ──
    sendNotificationEmail(body, formType).catch(err => {
      console.error('Failed to send notification email:', err)
    })

    return NextResponse.json(
      { ok: true, id: submission.id },
      { status: 201, headers: CORS_HEADERS }
    )

  } catch (error) {
    console.error('Public submission error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

// ─── Notification email ───────────────────────────────────────
// Sends a formatted email to info@frederickwraps.com using the
// existing Resend API key (same one used for quotes/invoices).

const COVERAGE_LABELS: Record<string, string> = {
  full_wrap: 'Full Coverage Wrap', partial_wrap: 'Partial Wrap',
  graphics_lettering: 'Graphics & Lettering', not_sure: 'Not Sure Yet',
}
const ARTWORK_LABELS: Record<string, string> = {
  fleet_match: 'Fleet Match', print_ready: 'Print-Ready Artwork',
  logo_vision: 'Logo + Vision', logo_only: 'Logo Only',
  from_scratch: 'Start from Scratch', ai_mockup: 'AI-Generated Mockup',
}
const TIMELINE_LABELS: Record<string, string> = {
  asap: 'ASAP', '30_days': 'Within 30 days', '30_60_days': '30–60 days',
  '60_90_days': '60–90+ days', planning: 'Just planning',
}
const BUDGET_LABELS: Record<string, string> = {
  under_1000: 'Under $1,000', '1000_2500': '$1K–$2.5K', '2500_5000': '$2.5K–$5K',
  '5000_10000': '$5K–$10K', '10000_plus': '$10K+', not_sure: 'Not sure yet',
}

function sectionHeader(title: string) {
  return `<tr><td colspan="2" style="padding:18px 16px 8px;font-size:15px;font-weight:700;color:#CE0000;border-bottom:2px solid #CE0000;">${title}</td></tr>`
}
function emailRow(label: string, value: string | undefined | null) {
  return `<tr><td style="padding:8px 16px;color:#7D7D7D;font-weight:500;width:120px;vertical-align:top;">${label}</td><td style="padding:8px 16px;color:#1D1D1D;font-weight:500;">${value || '—'}</td></tr>`
}
function formatLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── PPF labels ──────────────────────────────────────────
const PPF_PACKAGE_LABELS: Record<string, string> = {
  full_vehicle: 'Full Vehicle PPF',
  full_front: 'Full Front End',
  track_pack: 'Track Pack',
  partial: 'Partial / Custom',
}
const PPF_FINISH_LABELS: Record<string, string> = {
  gloss: 'Gloss', matte: 'Matte / Satin', color: 'Colored PPF',
}
const ADDON_LABELS: Record<string, string> = {
  window_tint: 'Window Tint',
  ceramic_coating: 'Ceramic Coating',
  dash_cam: 'Dash Cam Install',
}

// ─── Service labels for styling forms ──────────────────────
const SERVICE_LABELS: Record<string, string> = {
  printed_wraps: 'Printed Wraps',
  color_change: 'Full Color Change',
  styling_graphics: 'Styling Graphics',
  tuxedo_roof: 'Tuxedo / Roof Wraps',
  chrome_delete: 'Chrome Delete',
  custom_taillights: 'Custom Taillights',
  racing_stripes: 'Racing Stripes',
  custom_decals: 'Custom Decals',
  window_flags: 'Back Window Flags',
  other: 'Other',
}

async function sendNotificationEmail(body: Record<string, any>, formType: string) {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) return

  const vehicles = body.vehicles || []
  let vehicleHTML = ''
  vehicles.forEach((v: any, i: number) => {
    vehicleHTML += `<tr><td colspan="2" style="padding:12px 16px 6px;font-weight:700;color:#1D1D1D;font-size:14px;border-bottom:1px solid #EDEEEE;">Vehicle ${i + 1}: ${v.type_label || v.type}</td></tr>`
    if (v.is_other) {
      vehicleHTML += emailRow('Description', v.other_desc)
    } else {
      if (v.year) vehicleHTML += emailRow('Year', v.year)
      if (v.make) vehicleHTML += emailRow('Make', v.make)
      if (v.model) vehicleHTML += emailRow('Model', v.model)
      if (v.color) vehicleHTML += emailRow('Color', v.color === 'other' ? v.color_other : v.color)
      if (v.browsing) vehicleHTML += emailRow('Note', "Just exploring — doesn't have vehicle yet")
      if (v.conditionals) {
        Object.entries(v.conditionals).forEach(([key, val]) => {
          if (val) vehicleHTML += emailRow(formatLabel(key), val as string)
        })
      }
    }
    if (v.photo_urls && v.photo_urls.length > 0) {
      vehicleHTML += emailRow('Photos', v.photo_urls.map((u: string) => `<a href="${u}" style="color:#2B5EA7;">View</a>`).join(' &nbsp; '))
    }
    if (v.paint_condition) {
      vehicleHTML += emailRow('Paint Condition', v.paint_condition)
    }
    if (v.paint_issue) {
      vehicleHTML += emailRow('Paint Issues', 'Yes' + (v.paint_desc ? ' — ' + v.paint_desc : ''))
    }
  })

  const logoHTML = body.logo_urls && body.logo_urls.length > 0
    ? emailRow('Logo Files', body.logo_urls.map((u: string) => `<a href="${u}" style="color:#2B5EA7;">Download</a>`).join(' &nbsp; '))
    : ''

  const now = new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  // ── Build form-type-specific sections ──
  let projectSectionHTML = ''

  if (formType === 'ppf') {
    // PPF package & finish
    projectSectionHTML += `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('PPF Details')}
      ${emailRow('Package', PPF_PACKAGE_LABELS[body.ppf_package] || body.ppf_package)}
      ${body.ppf_finish ? emailRow('Finish', PPF_FINISH_LABELS[body.ppf_finish] || body.ppf_finish) : ''}
    </table>`

    // Colored PPF details (if applicable)
    if (body.ppf_film_color) {
      let colorRows = emailRow('Film Color', body.ppf_film_color === 'other' ? (body.ppf_film_color_other || 'Other') : formatLabel(body.ppf_film_color))
      if (body.ppf_colored_description) colorRows += emailRow('Description', body.ppf_colored_description)
      if (body.ppf_colored_inspo_urls && body.ppf_colored_inspo_urls.length > 0) {
        colorRows += emailRow('Inspiration', body.ppf_colored_inspo_urls.map((u: string, i: number) => `<a href="${u}" style="color:#2B5EA7;">Image ${i + 1}</a>`).join(' &nbsp; '))
      }
      projectSectionHTML += `
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        ${sectionHeader('Colored PPF')}
        ${colorRows}
      </table>`
    }

    // Add-ons
    const addons = body.addons || []
    if (addons.length > 0) {
      const addonLabels = addons.map((a: string) => ADDON_LABELS[a] || formatLabel(a)).join(', ')
      projectSectionHTML += `
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        ${sectionHeader('Add-ons')}
        ${emailRow('Selected', addonLabels)}
      </table>`
    }

    // Reference images
    const refImages = body.reference_image_urls || []
    if (refImages.length > 0) {
      projectSectionHTML += `
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        ${sectionHeader('Reference Images')}
        ${emailRow('Files', refImages.map((u: string, i: number) => `<a href="${u}" style="color:#2B5EA7;">Image ${i + 1}</a>`).join(' &nbsp; '))}
      </table>`
    }
  } else if (formType === 'automotive_styling') {
    // Services section
    const services = body.services || []
    const serviceLabels = services.map((s: string) => SERVICE_LABELS[s] || formatLabel(s)).join(', ')
    projectSectionHTML += `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Selected Services')}
      ${emailRow('Services', serviceLabels || 'None selected')}
    </table>`

    // Service details
    const serviceDetails = body.service_details || {}
    if (Object.keys(serviceDetails).length > 0) {
      let detailRows = ''
      for (const [svc, detail] of Object.entries(serviceDetails)) {
        if (detail && typeof detail === 'object') {
          const d = detail as Record<string, any>
          const parts = Object.entries(d).map(([k, v]) => `${formatLabel(k)}: ${v}`).join(', ')
          detailRows += emailRow(SERVICE_LABELS[svc] || formatLabel(svc), parts)
        } else if (detail) {
          detailRows += emailRow(SERVICE_LABELS[svc] || formatLabel(svc), String(detail))
        }
      }
      if (detailRows) {
        projectSectionHTML += `
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
          ${sectionHeader('Service Details')}
          ${detailRows}
        </table>`
      }
    }

    // Reference images
    const refImages = body.reference_image_urls || []
    if (refImages.length > 0) {
      projectSectionHTML += `
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        ${sectionHeader('Reference Images')}
        ${emailRow('Files', refImages.map((u: string, i: number) => `<a href="${u}" style="color:#2B5EA7;">Image ${i + 1}</a>`).join(' &nbsp; '))}
      </table>`
    }
  } else {
    // Commercial wrap sections
    projectSectionHTML += `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Coverage Type')}
      ${emailRow('Type', COVERAGE_LABELS[body.coverage_type] || body.coverage_type)}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Artwork & Design')}
      ${emailRow('Status', ARTWORK_LABELS[body.artwork_status] || body.artwork_status)}
      ${body.ai_acknowledged ? emailRow('AI Policy', '✓ Acknowledged') : ''}
      ${logoHTML}
    </table>`
  }

  let emailTitle: string
  let emailSubject: string

  if (formType === 'ppf') {
    emailTitle = 'New PPF Inquiry'
    emailSubject = `New PPF Inquiry — ${body.contact_name} (${PPF_PACKAGE_LABELS[body.ppf_package] || body.ppf_package})`
  } else if (formType === 'automotive_styling') {
    emailTitle = 'New Styling Inquiry'
    emailSubject = `New Styling Inquiry — ${body.contact_name} (${(body.services || []).length} service${(body.services || []).length !== 1 ? 's' : ''})`
  } else {
    emailTitle = 'New Quote Request'
    emailSubject = `New Quote Request — ${body.business_name} (${COVERAGE_LABELS[body.coverage_type] || body.coverage_type})`
  }

  const emailHTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#F4F4F4;">
  <div style="max-width:600px;margin:20px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#1D1D1D;padding:24px 28px;">
      <h1 style="margin:0;color:#FFFFFF;font-size:18px;font-weight:700;">${emailTitle}</h1>
      <p style="margin:6px 0 0;color:#AAAAAA;font-size:13px;">${now}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Contact Information')}
      ${body.business_name ? emailRow('Business', body.business_name) : ''}
      ${emailRow('Contact', body.contact_name)}
      ${emailRow('Email', `<a href="mailto:${body.email}" style="color:#2B5EA7;">${body.email}</a>`)}
      ${emailRow('Phone', `<a href="tel:${body.phone}" style="color:#2B5EA7;">${body.phone}</a>`)}
      ${emailRow('Preferred', body.contact_method)}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Vehicle Details')}
      ${vehicleHTML}
    </table>
    ${projectSectionHTML}
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Timeline & Budget')}
      ${emailRow('Timeline', TIMELINE_LABELS[body.timeline] || body.timeline)}
      ${body.budget ? emailRow('Budget', BUDGET_LABELS[body.budget] || body.budget) : ''}
    </table>
    ${body.additional_info ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Additional Notes')}
      <tr><td style="padding:10px 16px 16px;color:#1D1D1D;line-height:1.5;">${body.additional_info}</td></tr>
    </table>` : ''}
    <div style="padding:16px 28px;background:#F7F7F7;text-align:center;">
      <p style="margin:0;color:#7D7D7D;font-size:12px;">Submitted from ${body.source_page || 'website'}</p>
    </div>
  </div>
</body></html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Frederick Wraps <quotes@frederickwraps.com>',
      to: ['info@frederickwraps.com'],
      subject: emailSubject,
      html: emailHTML,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    console.error(`Resend API error [${formType}]: ${res.status} — ${errBody}`)
    throw new Error(`Resend ${res.status}: ${errBody}`)
  }

  console.log(`Notification email sent for ${formType} submission`)
}
