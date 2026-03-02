import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { generateSubmissionAction } from '@/app/lib/customer/actionGenerator'
import { uploadClickConversion } from '@/app/lib/googleAdsConversion'

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

    let formType = String(body.form_type || body.formType || '').trim().toLowerCase()

    // Auto-detect form type from payload fields when not explicitly set
    if (!formType) {
      if (body.ppf_package) {
        formType = 'ppf'
      } else if (body.sticker_type) {
        formType = 'sticker_label'
      } else if (Array.isArray(body.signage_types) && body.signage_types.length > 0) {
        formType = 'signage_promo'
      } else if (Array.isArray(body.items) && body.items.length > 0 && body.garment_supply) {
        formType = 'embroidery'
      } else if (body.equipment) {
        formType = 'cafe_wrap'
      } else if (Array.isArray(body.services) && body.services.length > 0) {
        formType = 'automotive_styling'
      } else {
        formType = 'commercial_wrap'
      }
    }

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

    // Resolve business_name from alternate field name (sticker form sends "company")
    if (!body.business_name && body.company) {
      body.business_name = String(body.company).trim()
    }

    console.log(`[${formType}] submission received — keys: ${Object.keys(body).join(', ')}, email: ${JSON.stringify(body.email)}`)

    // ── Validate required fields (varies by form type) ──
    const REQUIRED_BY_FORM_TYPE: Record<string, string[]> = {
      ad_landing: ["contact_name", "email", "phone"],
      commercial_wrap: ['business_name', 'contact_name', 'email', 'phone', 'contact_method', 'coverage_type', 'artwork_status', 'timeline'],
      automotive_styling: ['contact_name', 'email', 'phone', 'contact_method', 'timeline'],
      ppf: ['contact_name', 'email', 'phone', 'contact_method', 'ppf_package', 'timeline'],
      cafe_wrap: ['contact_name', 'email', 'phone', 'contact_method', 'timeline'],
      sticker_label: ['contact_name', 'email', 'contact_method', 'sticker_type', 'shape', 'material', 'timeline'],
      signage_promo: ['contact_name', 'email', 'contact_method', 'quantity', 'timeline'],
      embroidery: ['contact_name', 'email', 'contact_method', 'garment_supply', 'design_size', 'digitizing', 'timeline'],
    }
    const required = REQUIRED_BY_FORM_TYPE[formType]
    if (!required) {
      return NextResponse.json(
        { error: `Unknown form type: ${formType}` },
        { status: 400, headers: CORS_HEADERS }
      )
    }
    const missing = required.filter(f => !body[f])
    if (missing.length > 0) {
      console.error(`Missing required fields [${formType}]:`, missing, '| Received keys:', Object.keys(body), '| Body:', JSON.stringify(body).slice(0, 500))
      return NextResponse.json(
        { error: 'Missing required fields', fields: missing },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // ── Café wrap: validate equipment is a non-empty array ──
    if (formType === 'cafe_wrap') {
      if (!Array.isArray(body.equipment) || body.equipment.length === 0) {
        console.error(`Invalid equipment payload [${formType}]: expected non-empty array, got`, typeof body.equipment)
        return NextResponse.json(
          { error: 'Equipment must be a non-empty array' },
          { status: 400, headers: CORS_HEADERS }
        )
      }
    }

    // ── Embroidery: validate items is a non-empty array ──
    if (formType === 'embroidery') {
      if (!Array.isArray(body.items) || body.items.length === 0) {
        console.error(`Invalid items payload [${formType}]: expected non-empty array, got`, typeof body.items)
        return NextResponse.json(
          { error: 'Items must be a non-empty array' },
          { status: 400, headers: CORS_HEADERS }
        )
      }
    }

    // ── Signage promo: validate signage_types is a non-empty array ──
    if (formType === 'signage_promo') {
      if (!Array.isArray(body.signage_types) || body.signage_types.length === 0) {
        console.error(`Invalid signage_types payload [${formType}]: expected non-empty array, got`, typeof body.signage_types)
        return NextResponse.json(
          { error: 'signage_types must be a non-empty array' },
          { status: 400, headers: CORS_HEADERS }
        )
      }
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
        vehicle_description: body.vehicle_description || null,
        source_page: body.source_page || null,
        user_agent: body.user_agent || request.headers.get('user-agent') || null,

        // ── Ad attribution (first-touch, set by Shopify cookie script) ──
        gclid: body.gclid || null,
        gbraid: body.gbraid || null,
        wbraid: body.wbraid || null,
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        utm_content: body.utm_content || null,
        utm_term: body.utm_term || null,
        landing_page: body.landing_page || null,
        referrer: body.referrer || null,

        // ── Styling-form-specific columns ──
        services: body.services || [],
        service_details: formType === 'ppf'
          ? {
              ppf_film_color: body.ppf_film_color || null,
              ppf_film_color_other: body.ppf_film_color_other || null,
              ppf_colored_description: body.ppf_colored_description || null,
              ppf_colored_inspo_urls: body.ppf_colored_inspo_urls || null,
            }
          : formType === 'cafe_wrap'
          ? {
              equipment: body.equipment || [],
              equipment_photo_urls: body.equipment_photo_urls || [],
              branding_file_urls: body.branding?.file_urls || [],
              branding_vision: body.branding?.vision || null,
            }
          : formType === 'sticker_label'
          ? {
              size: body.size || null,
              quantity: body.quantity || null,
              notes: body.notes || null,
              design_file_urls: body.design_file_urls || [],
            }
          : formType === 'signage_promo'
          ? {
              quantity: body.quantity || null,
              size: body.size || null,
              notes: body.notes || null,
              design_file_urls: body.design_file_urls || [],
            }
          : formType === 'embroidery'
          ? {
              sourcing_notes: body.sourcing_notes || null,
              notes: body.notes || null,
              design_file_urls: body.design_file_urls || [],
            }
          : (body.service_details || {}),
        reference_image_urls: body.reference_image_urls || [],

        // ── PPF-form-specific columns ──
        ppf_package: body.ppf_package || null,
        ppf_finish: body.ppf_finish || null,
        addons: body.addons || null,

        // ── Café-wrap-specific columns ──
        location_city: body.location?.city || null,
        location_state: body.location?.state || null,
        delivery_method: body.delivery_method || null,
        branding_status: body.branding?.status || null,

        // ── Sticker/label-specific columns ──
        sticker_type: body.sticker_type || null,
        shape: body.shape || null,
        material: body.material || null,
        finish: body.finish || null,

        // ── Signage/promo-specific columns ──
        signage_types: body.signage_types || [],

        // ── Embroidery-specific columns ──
        embroidery_items: body.items || [],
        garment_supply: body.garment_supply || null,
        design_size: body.design_size || null,
        digitizing: body.digitizing || null,
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

    // ── Upload Google Ads offline conversion (non-blocking) ──
    const gclid = body.gclid as string | undefined
    if (gclid) {
      uploadClickConversion(gclid, new Date()).catch(err => {
        console.error('Google Ads conversion upload error:', err)
      })
    }

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

// ─── Café equipment labels ──────────────────────────────
const EQUIPMENT_LABELS: Record<string, string> = {
  espresso_machine: 'Espresso Machine', drip_brewer: 'Drip Brewer',
  bean_grinder: 'Bean Grinder', milk_steamer: 'Milk Steamer',
  other: 'Other Equipment',
}
const DELIVERY_LABELS: Record<string, string> = {
  deliver_to_fwg: 'Delivered to FWG', vendor_coordination: 'Vendor Coordination',
  onsite: 'On-site Wrap', not_sure: 'Not Sure Yet',
}
const BRANDING_LABELS: Record<string, string> = {
  ready: 'Branding Ready', needs_adjustments: 'Needs Adjustments',
  need_design: 'Need Design Help',
}

// ─── Sticker & label labels ──────────────────────────────
const STICKER_TYPE_LABELS: Record<string, string> = {
  'die-cut': 'Die-Cut Stickers', 'kiss-cut': 'Kiss-Cut / Easy Peel',
  'sticker-sheets': 'Sticker Sheets', 'roll-labels': 'Roll Labels',
}
const STICKER_SHAPE_LABELS: Record<string, string> = {
  contoured: 'Contoured', circle: 'Circle',
  'rounded-corners': 'Rounded Corners', 'sharp-corners': 'Sharp Corners',
  custom: 'Custom / Other',
}
const STICKER_MATERIAL_LABELS: Record<string, string> = {
  vinyl: 'Vinyl', holographic: 'Holographic', clear: 'Clear',
  'low-tack': 'Low Tack / Wall', unsure: 'Not Sure',
}
const STICKER_FINISH_LABELS: Record<string, string> = {
  gloss: 'Gloss', matte: 'Matte', unsure: 'Not Sure',
}
const STICKER_TIMELINE_LABELS: Record<string, string> = {
  standard: 'Standard (5–7 business days)',
  rush: 'Rush (2–3 business days)',
  urgent: 'Urgent (24–48 hours)',
  same_day: 'Same Day — URGENT',
  flexible: 'No Rush — Flexible',
}

// ─── Signage & Promo labels ──────────────────────────────
const SIGNAGE_TYPE_LABELS: Record<string, string> = {
  // Common (grid selections)
  outdoor_building: 'Outdoor Building Signage',
  window_perf: 'View-Through Window Perf',
  storefront_hours: 'Storefront Hours',
  raised_signage: 'Interior Raised Signage',
  wall_graphics: 'Wall Graphics',
  floor_graphics: 'Floor Graphics',
  yard_signs: 'Yard Signs',
  banner_stands: 'Banner Stands',
  pvc_banners: 'PVC Banners',
  a_frame_signs: 'A-Frame Signs & Sign Inserts',
  coroplast_signs: 'Coroplast Signs',
  backdrop_displays: 'Backdrop Displays',
  // Extended catalog
  real_estate_signs: 'Real estate signs',
  parking_regulatory: 'Parking & regulatory signs',
  construction_signs: 'Construction site signs',
  fence_barricade: 'Fence & barricade graphics',
  directional_wayfinding_ext: 'Directional & wayfinding (exterior)',
  hanging_signs: 'Hanging signs',
  lobby_reception: 'Lobby & reception signs',
  acrylic_glass: 'Acrylic & glass prints',
  directional_wayfinding_int: 'Directional & wayfinding (interior)',
  backlit_lightbox: 'Backlit displays & lightbox graphics',
  pop_displays: 'Point-of-purchase displays',
  shelf_talkers: 'Shelf talkers & aisle markers',
  menu_boards: 'Menu boards',
  posters_prints: 'Posters & mounted prints',
  tabletop_displays: 'Tabletop displays',
  temp_event_signage: 'Temporary event signage',
  reflective_safety: 'Reflective & safety signs',
  aluminum_composite: 'Aluminum composite signs',
  magnetic_signs: 'Magnetic signs',
  dry_erase: 'Dry erase boards & writable graphics',
  fabric_graphics: 'Repositionable fabric graphics',
  backlit_film: 'Backlit film prints',
  frosted_etched: 'Frosted & etched glass vinyl',
}
const SIGNAGE_TIMELINE_LABELS: Record<string, string> = {
  same_day: '🚨 Same Day — URGENT',
  urgent: '🔴 Urgent (24–48 hrs)',
  rush: '🔶 Rush (2–3 days)',
  standard: 'Standard (5–7 days)',
  '30_days': 'Within 30 days',
  '30_60_days': '30–60 days',
  '60_90_days': '60–90+ days',
  flexible: 'No Rush — Flexible',
}

// ─── Embroidery labels ──────────────────────────────
const EMBROIDERY_PRODUCT_LABELS: Record<string, string> = {
  polos: 'Polo Shirts', hats: 'Hats / Caps', hoodies: 'Hoodies / Sweaters',
  jackets: 'Jackets', bags: 'Bags / Totes', aprons: 'Aprons / Workwear',
  blankets: 'Blankets / Towels', other_product: 'Other',
}
const EMBROIDERY_PLACEMENT_LABELS: Record<string, string> = {
  left_chest: 'Left Chest', right_chest: 'Right Chest', center_chest: 'Center Chest',
  full_back: 'Full Back', upper_back: 'Upper Back', sleeve: 'Sleeve(s)',
  collar_nape: 'Collar / Nape', hood: 'Hood', hat_front: 'Hat Front',
  hat_side: 'Hat Side', hat_back: 'Hat Back', front: 'Front', back: 'Back',
  strap: 'Strap', pocket: 'Pocket', full_front: 'Full Front', corner: 'Corner',
  center: 'Center', other_custom: 'Other / Custom',
}
const EMBROIDERY_GARMENT_SUPPLY_LABELS: Record<string, string> = {
  customer_supplies: 'Customer providing garments',
  fwg_sources: 'FWG sourcing garments',
  not_sure: 'Not sure yet',
}
const EMBROIDERY_DESIGN_SIZE_LABELS: Record<string, string> = {
  small: 'Small (under 4")', medium: 'Medium (4–7")', large: 'Large (7–12")',
  oversized: 'Oversized (12"+)', not_sure: 'Not sure',
}
const EMBROIDERY_DIGITIZING_LABELS: Record<string, string> = {
  have_file: 'Has embroidery-ready file',
  needs_digitizing: 'Needs digitizing',
  not_sure: 'Not sure',
}
const EMBROIDERY_TIMELINE_LABELS: Record<string, string> = {
  same_day: '🚨 Same Day — URGENT',
  urgent: '🔴 Urgent (24–48 hrs)',
  rush: '🔶 Rush (2–3 days)',
  standard: 'Standard (5–7 days)',
  '30_days': 'Within 30 days',
  '30_60_days': '30–60 days',
  '60_90_days': '60–90+ days',
  flexible: 'No Rush — Flexible',
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
  } else if (formType === 'cafe_wrap') {
    // Café equipment wrap sections — equipment is now an array of per-item objects
    const equipItems: Array<{ type: string; model?: string; quantity?: string }> = Array.isArray(body.equipment) ? body.equipment : []
    let equipRows = ''
    equipItems.forEach((item: any) => {
      const label = EQUIPMENT_LABELS[item.type] || formatLabel(item.type || 'Unknown')
      const qty = item.quantity || '1'
      const line = item.model ? `${label} × ${qty} — ${item.model}` : `${label} × ${qty}`
      equipRows += emailRow('Item', line)
    })
    const equipPhotos = (body.equipment_photo_urls || []).length > 0
      ? emailRow('Photos', body.equipment_photo_urls.map((u: string, i: number) => `<a href="${u}" style="color:#2B5EA7;">Photo ${i + 1}</a>`).join(' &nbsp; '))
      : ''

    projectSectionHTML += `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Equipment Details')}
      ${equipRows || emailRow('Equipment', '—')}
      ${equipPhotos}
    </table>`

    // Location
    const loc = body.location || {}
    if (loc.city || loc.state) {
      projectSectionHTML += `
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        ${sectionHeader('Location')}
        ${loc.city ? emailRow('City', loc.city) : ''}
        ${loc.state ? emailRow('State', loc.state) : ''}
      </table>`
    }

    // Branding
    const branding = body.branding || {}
    projectSectionHTML += `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Branding Status')}
      ${emailRow('Status', BRANDING_LABELS[branding.status] || branding.status || '—')}
      ${branding.vision ? emailRow('Vision', branding.vision) : ''}
      ${(branding.file_urls || []).length > 0 ? emailRow('Brand Files', branding.file_urls.map((u: string, i: number) => `<a href="${u}" style="color:#2B5EA7;">File ${i + 1}</a>`).join(' &nbsp; ')) : ''}
    </table>`

    // Logistics
    projectSectionHTML += `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Logistics')}
      ${emailRow('Delivery Method', DELIVERY_LABELS[body.delivery_method] || body.delivery_method || '—')}
    </table>`

    // Reference images
    const refImages = body.reference_image_urls || []
    if (refImages.length > 0) {
      projectSectionHTML += `
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        ${sectionHeader('Reference Images')}
        ${emailRow('Files', refImages.map((u: string, i: number) => `<a href="${u}" style="color:#2B5EA7;">Image ${i + 1}</a>`).join(' &nbsp; '))}
      </table>`
    }
  } else if (formType === 'sticker_label') {
    // Sticker & Label sections
    const stickerSize = body.size
    let sizeDisplay = '—'
    if (stickerSize && typeof stickerSize === 'object' && stickerSize.width && stickerSize.height) {
      sizeDisplay = `${stickerSize.width}" × ${stickerSize.height}"`
    } else if (stickerSize) {
      sizeDisplay = `${stickerSize}"`
    }

    // Timeline row with urgency styling
    const stickerTL = body.timeline || ''
    const stickerTLLabel = STICKER_TIMELINE_LABELS[stickerTL] || stickerTL
    const isUrgentTL = stickerTL === 'same_day' || stickerTL === 'urgent' || stickerTL === 'rush'
    const tlColor = stickerTL === 'same_day' ? '#CE0000' : stickerTL === 'urgent' ? '#D84315' : stickerTL === 'rush' ? '#E65100' : '#1D1D1D'
    const timelineRowHTML = `<tr><td style="padding:8px 16px;color:#7D7D7D;font-weight:500;width:120px;vertical-align:top;">Timeline</td><td style="padding:8px 16px;color:${isUrgentTL ? tlColor : '#1D1D1D'};font-weight:${isUrgentTL ? '700' : '500'};">${stickerTLLabel}</td></tr>`

    projectSectionHTML += `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Sticker Details')}
      ${emailRow('Type', STICKER_TYPE_LABELS[body.sticker_type] || body.sticker_type)}
      ${emailRow('Shape', STICKER_SHAPE_LABELS[body.shape] || body.shape)}
      ${emailRow('Material', STICKER_MATERIAL_LABELS[body.material] || body.material)}
      ${emailRow('Size', sizeDisplay)}
      ${body.quantity ? emailRow('Quantity', body.quantity) : ''}
      ${body.finish ? emailRow('Finish', STICKER_FINISH_LABELS[body.finish] || body.finish) : ''}
      ${timelineRowHTML}
    </table>`

    if (body.notes) {
      projectSectionHTML += `
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        ${sectionHeader('Project Notes')}
        <tr><td style="padding:10px 16px 16px;color:#1D1D1D;line-height:1.5;">${body.notes}</td></tr>
      </table>`
    }

    const designFiles = body.design_file_urls || []
    if (designFiles.length > 0) {
      projectSectionHTML += `
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        ${sectionHeader('Design Files')}
        ${emailRow('Files', designFiles.map((u: string, i: number) => `<a href="${u}" style="color:#2B5EA7;">File ${i + 1}</a>`).join(' &nbsp; '))}
      </table>`
    }
  } else if (formType === 'signage_promo') {
    // Signage & Promo sections
    const signageTypes: string[] = body.signage_types || []
    const signageTypesList = signageTypes.map((t: string) => SIGNAGE_TYPE_LABELS[t] || formatLabel(t)).join(', ')

    // Timeline row with urgency styling
    const signageTL = body.timeline || ''
    const signageTLLabel = SIGNAGE_TIMELINE_LABELS[signageTL] || signageTL
    const isUrgentSignage = signageTL === 'same_day' || signageTL === 'urgent' || signageTL === 'rush'
    const signageTLColor = signageTL === 'same_day' ? '#CE0000' : signageTL === 'urgent' ? '#D84315' : signageTL === 'rush' ? '#E65100' : '#1D1D1D'
    const signageTimelineRowHTML = `<tr><td style="padding:8px 16px;color:#7D7D7D;font-weight:500;width:120px;vertical-align:top;">Timeline</td><td style="padding:8px 16px;color:${isUrgentSignage ? signageTLColor : '#1D1D1D'};font-weight:${isUrgentSignage ? '700' : '500'};">${signageTLLabel}</td></tr>`

    projectSectionHTML += `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Signage Types')}
      ${signageTypes.map((t: string) => emailRow('•', SIGNAGE_TYPE_LABELS[t] || formatLabel(t))).join('')}
    </table>`

    projectSectionHTML += `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Project Details')}
      ${body.quantity ? emailRow('Quantity', body.quantity) : ''}
      ${body.size ? emailRow('Size', body.size) : ''}
      ${signageTimelineRowHTML}
    </table>`

    const signageDesignFiles = body.design_file_urls || []
    if (signageDesignFiles.length > 0) {
      projectSectionHTML += `
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        ${sectionHeader('Design Files')}
        ${emailRow('Files', signageDesignFiles.map((u: string, i: number) => `<a href="${u}" style="color:#2B5EA7;">File ${i + 1}</a>`).join(' &nbsp; '))}
      </table>`
    }

    if (body.notes) {
      projectSectionHTML += `
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        ${sectionHeader('Project Notes')}
        <tr><td style="padding:10px 16px 16px;color:#1D1D1D;line-height:1.5;">${body.notes}</td></tr>
      </table>`
    }
  } else if (formType === 'embroidery') {
    // ── Embroidery sections ──
    const items: Array<{ product: string; placements?: string[]; quantity?: string; description?: string }> = body.items || []

    // Products section — loop through items
    let itemsHTML = ''
    items.forEach((item: any, idx: number) => {
      const productLabel = EMBROIDERY_PRODUCT_LABELS[item.product] || formatLabel(item.product || 'Unknown')
      const placements = (item.placements || []).map((p: string) => EMBROIDERY_PLACEMENT_LABELS[p] || formatLabel(p)).join(', ')
      itemsHTML += `<tr><td colspan="2" style="padding:12px 16px 6px;font-weight:700;color:#1D1D1D;font-size:14px;border-bottom:1px solid #EDEEEE;">Product ${idx + 1}: ${productLabel}</td></tr>`
      if (item.product === 'other_product' && item.description) {
        itemsHTML += emailRow('Description', item.description)
      } else if (placements) {
        itemsHTML += emailRow('Placements', placements)
      }
      if (item.quantity) itemsHTML += emailRow('Quantity', item.quantity)
    })
    projectSectionHTML += `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Products')}
      ${itemsHTML}
    </table>`

    // Garment supply + sourcing notes
    projectSectionHTML += `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Garment Supply')}
      ${emailRow('Supply', EMBROIDERY_GARMENT_SUPPLY_LABELS[body.garment_supply] || body.garment_supply)}
      ${body.sourcing_notes ? emailRow('Sourcing Notes', body.sourcing_notes) : ''}
    </table>`

    // Design details
    projectSectionHTML += `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Design Details')}
      ${emailRow('Size', EMBROIDERY_DESIGN_SIZE_LABELS[body.design_size] || body.design_size)}
      ${emailRow('Digitizing', EMBROIDERY_DIGITIZING_LABELS[body.digitizing] || body.digitizing)}
    </table>`

    // Design files
    const embDesignFiles = body.design_file_urls || []
    if (embDesignFiles.length > 0) {
      projectSectionHTML += `
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        ${sectionHeader('Design Files')}
        ${emailRow('Files', embDesignFiles.map((u: string, i: number) => `<a href="${u}" style="color:#2B5EA7;">File ${i + 1}</a>`).join(' &nbsp; '))}
      </table>`
    }

    // Timeline with urgency styling
    const embTL = body.timeline || ''
    const embTLLabel = EMBROIDERY_TIMELINE_LABELS[embTL] || embTL
    const isUrgentEmb = embTL === 'same_day' || embTL === 'urgent' || embTL === 'rush'
    const embTLColor = embTL === 'same_day' ? '#CE0000' : embTL === 'urgent' ? '#D84315' : embTL === 'rush' ? '#E65100' : '#1D1D1D'
    const embTimelineRowHTML = `<tr><td style="padding:8px 16px;color:#7D7D7D;font-weight:500;width:120px;vertical-align:top;">Timeline</td><td style="padding:8px 16px;color:${isUrgentEmb ? embTLColor : '#1D1D1D'};font-weight:${isUrgentEmb ? '700' : '500'};">${embTLLabel}</td></tr>`

    projectSectionHTML += `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Timeline')}
      ${embTimelineRowHTML}
    </table>`

    // Project notes
    if (body.notes) {
      projectSectionHTML += `
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        ${sectionHeader('Project Notes')}
        <tr><td style="padding:10px 16px 16px;color:#1D1D1D;line-height:1.5;">${body.notes}</td></tr>
      </table>`
    }
  } else if (formType === 'ad_landing') {
    projectSectionHTML += `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Project Details')}
      ${body.vehicle_description ? emailRow('Vehicle', body.vehicle_description) : ''}
      ${body.additional_info ? `<tr><td style="padding:10px 16px 16px;color:#1D1D1D;line-height:1.5;">${body.additional_info}</td></tr>` : ''}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Ad Attribution')}
      ${emailRow('Landing Page', body.source_page || '—')}
      ${body.utm_source ? emailRow('Source', body.utm_source) : ''}
      ${body.utm_medium ? emailRow('Medium', body.utm_medium) : ''}
      ${body.utm_campaign ? emailRow('Campaign', body.utm_campaign) : ''}
      ${body.utm_term ? emailRow('Keyword', body.utm_term) : ''}
      ${body.gclid ? emailRow('GCLID', '✓ Captured') : ''}
    </table>`
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
  } else if (formType === 'cafe_wrap') {
    // Sum per-item quantities; treat "5+" as 5
    const equipArr: Array<{ quantity?: string }> = Array.isArray(body.equipment) ? body.equipment : []
    const totalPieces = equipArr.reduce((sum: number, item: any) => {
      const q = parseInt(String(item.quantity || '1').replace('+', ''), 10)
      return sum + (isNaN(q) ? 1 : q)
    }, 0)
    emailTitle = 'New Café Wrap Inquiry'
    emailSubject = `New Café Wrap Inquiry — ${body.contact_name} (${totalPieces} piece${totalPieces !== 1 ? 's' : ''})`
  } else if (formType === 'sticker_label') {
    emailTitle = 'New Sticker Inquiry'
    const tl = body.timeline || ''
    if (tl === 'same_day') {
      emailSubject = `🚨 SAME DAY URGENT — Sticker Inquiry from ${body.contact_name}`
    } else if (tl === 'urgent') {
      emailSubject = `🔴 URGENT — Sticker Inquiry from ${body.contact_name} (24-48 hrs)`
    } else if (tl === 'rush') {
      emailSubject = `🔶 Rush Order — Sticker Inquiry from ${body.contact_name} (2-3 days)`
    } else {
      emailSubject = `New Sticker Inquiry — ${body.contact_name} (${body.quantity || '?'} pcs)`
    }
  } else if (formType === 'signage_promo') {
    emailTitle = 'New Signage Inquiry'
    const tl = body.timeline || ''
    const signageCount = (body.signage_types || []).length
    if (tl === 'same_day') {
      emailSubject = `🚨 SAME DAY URGENT — Signage Inquiry from ${body.contact_name}`
    } else if (tl === 'urgent') {
      emailSubject = `🔴 URGENT — Signage Inquiry from ${body.contact_name} (24-48 hrs)`
    } else if (tl === 'rush') {
      emailSubject = `🔶 Rush Order — Signage Inquiry from ${body.contact_name} (2-3 days)`
    } else {
      emailSubject = `New Signage Inquiry — ${body.contact_name} (${signageCount} item${signageCount !== 1 ? 's' : ''})`
    }
  } else if (formType === 'embroidery') {
    emailTitle = 'New Embroidery Inquiry'
    const tl = body.timeline || ''
    const itemCount = (body.items || []).length
    if (tl === 'same_day') {
      emailSubject = `🚨 SAME DAY URGENT — Embroidery Inquiry from ${body.contact_name}`
    } else if (tl === 'urgent') {
      emailSubject = `🔴 URGENT — Embroidery Inquiry from ${body.contact_name} (24-48 hrs)`
    } else if (tl === 'rush') {
      emailSubject = `🔶 Rush Order — Embroidery Inquiry from ${body.contact_name} (2-3 days)`
    } else {
      emailSubject = `New Embroidery Inquiry — ${body.contact_name} (${itemCount} product${itemCount !== 1 ? 's' : ''})`
    }
  } else if (formType === 'ad_landing') {
    emailTitle = 'New Landing Page Inquiry'
    const lp = body.source_page || 'landing page'
    emailSubject = `🎯 Ad Lead — ${body.contact_name}${body.business_name ? ` (${body.business_name})` : ''} — ${lp}`
  } else {
    emailTitle = 'New Quote Request'
    emailSubject = `New Quote Request — ${body.business_name} (${COVERAGE_LABELS[body.coverage_type] || body.coverage_type})`
  }

  // Build urgency banner for sticker_label, signage_promo, and embroidery forms
  let urgencyBannerHTML = ''
  if (formType === 'sticker_label' || formType === 'signage_promo' || formType === 'embroidery') {
    const tl = body.timeline || ''
    if (tl === 'same_day') {
      urgencyBannerHTML = `<div style="background:#CE0000;padding:18px 28px;text-align:center;"><span style="color:#FFFFFF;font-size:18px;font-weight:800;letter-spacing:0.5px;">🚨 SAME DAY URGENT — STOP AND HANDLE IMMEDIATELY 🚨</span></div>`
    } else if (tl === 'urgent') {
      urgencyBannerHTML = `<div style="background:#D84315;padding:16px 28px;text-align:center;"><span style="color:#FFFFFF;font-size:16px;font-weight:700;letter-spacing:0.5px;">🔴 URGENT REQUEST — 24-48 HOUR TURNAROUND</span></div>`
    } else if (tl === 'rush') {
      urgencyBannerHTML = `<div style="background:#E65100;padding:14px 28px;text-align:center;"><span style="color:#1D1D1D;font-size:15px;font-weight:700;letter-spacing:0.5px;">🔶 RUSH ORDER — 2-3 BUSINESS DAYS</span></div>`
    }
  }

  const emailHTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#F4F4F4;">
  <div style="max-width:600px;margin:20px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#1D1D1D;padding:24px 28px;">
      <h1 style="margin:0;color:#FFFFFF;font-size:18px;font-weight:700;">${emailTitle}</h1>
      <p style="margin:6px 0 0;color:#AAAAAA;font-size:13px;">${now}</p>
    </div>
    ${urgencyBannerHTML}
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Contact Information')}
      ${body.business_name ? emailRow('Business', body.business_name) : ''}
      ${emailRow('Contact', body.contact_name)}
      ${emailRow('Email', `<a href="mailto:${body.email}" style="color:#2B5EA7;">${body.email}</a>`)}
      ${emailRow('Phone', `<a href="tel:${body.phone}" style="color:#2B5EA7;">${body.phone}</a>`)}
      ${emailRow('Preferred', body.contact_method)}
    </table>
    ${formType !== 'cafe_wrap' && formType !== 'sticker_label' && formType !== 'signage_promo' && formType !== 'embroidery' && formType !== 'ad_landing' ? `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Vehicle Details')}
      ${vehicleHTML}
    </table>` : ''}
    ${projectSectionHTML}
    ${formType !== 'sticker_label' && formType !== 'signage_promo' && formType !== 'embroidery' && formType !== 'ad_landing' ? `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      ${sectionHeader('Timeline & Budget')}
      ${emailRow('Timeline', TIMELINE_LABELS[body.timeline] || body.timeline)}
      ${body.budget ? emailRow('Budget', BUDGET_LABELS[body.budget] || body.budget) : ''}
    </table>` : ''}
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
