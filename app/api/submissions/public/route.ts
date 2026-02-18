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

// ─── Main handler ───
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // ── Validate required fields ──
    const required = ['business_name', 'contact_name', 'email', 'phone', 'contact_method', 'coverage_type', 'artwork_status', 'timeline']
    const missing = required.filter(f => !body[f])
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Missing required fields', fields: missing },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // ── Basic email validation ──
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
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

        // Contact info (mapped to existing columns)
        customer_name: body.contact_name,
        customer_email: body.email,
        customer_phone: body.phone,
        company_name: body.business_name,
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
        coverage_type: body.coverage_type,
        artwork_status: body.artwork_status,
        ai_acknowledged: body.ai_acknowledged || false,
        logo_urls: body.logo_urls || [],
        budget: body.budget || null,
        additional_info: body.additional_info || null,
        source_page: body.source_page || null,
        user_agent: body.user_agent || null,
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
