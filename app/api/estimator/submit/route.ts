import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// CORS headers for cross-origin requests from Shopify
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.customer_name || !data.customer_email || !data.customer_phone) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: customer_name, customer_email, customer_phone' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Format phone number
    let phone = (data.customer_phone || '').replace(/\D/g, '')
    if (phone.length === 10) phone = '+1' + phone
    else if (!phone.startsWith('+')) phone = '+' + phone

    // =========================================================================
    // 1. Insert submission
    // =========================================================================
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .insert({
        status: 'new',
        source: data.source || 'estimator',
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: phone,
        preferred_contact: data.preferred_contact || null,
        company_name: data.company_name || null,
        website: data.website || null,
        vehicle_category: data.vehicle_category || null,
        vehicle_year: data.vehicle_year || null,
        vehicle_make: data.vehicle_make || null,
        vehicle_model: data.vehicle_model || null,
        vehicle_count: parseInt(data.vehicle_count) || 1,
        project_type: data.project_type || null,
        design_scenario: data.design_scenario || null,
        price_range_min: parseInt(data.price_range_min) || null,
        price_range_max: parseInt(data.price_range_max) || null,
        design_fee_min: parseInt(data.design_fee_min) || null,
        design_fee_max: parseInt(data.design_fee_max) || null,
        vision_description: data.vision_description || null,
        timeline: data.timeline || null,
        budget_range: data.budget_range || null,
        notes: data.notes || null,
      })
      .select()
      .single()

    if (subError) {
      console.error('Submission insert error:', subError)
      return NextResponse.json(
        { ok: false, error: 'Failed to create submission' },
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('Submission created:', submission.id)

    // =========================================================================
    // 2. Find or create customer
    // =========================================================================
    try {
      // Check by email first, then phone
      let { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('email', data.customer_email)
        .limit(1)
        .maybeSingle()

      if (!existing) {
        const { data: byPhone } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', phone)
          .limit(1)
          .maybeSingle()
        existing = byPhone
      }

      if (!existing) {
        // Split name into first/last
        const nameParts = (data.customer_name || '').trim().split(/\s+/)
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''

        const { data: newCustomer, error: custError } = await supabase
          .from('customers')
          .insert({
            first_name: firstName,
            last_name: lastName,
            display_name: data.customer_name,
            email: data.customer_email,
            phone: phone,
            company: data.company_name || null,
            source: 'estimator',
          })
          .select('id')
          .single()

        if (custError) {
          console.error('Customer create error:', custError)
        } else {
          console.log('Customer created:', newCustomer.id)
        }
      } else {
        console.log('Customer found:', existing.id)
      }
    } catch (custErr) {
      // Non-fatal: submission was already saved
      console.error('Customer find/create error:', custErr)
    }

    // =========================================================================
    // 3. Auto-create follow-up task
    // =========================================================================
    try {
      await supabase.from('tasks').insert({
        title: `Follow up: ${data.customer_name}`,
        description: `New estimator submission - ${data.project_type || 'Vehicle Wrap'} for ${data.vehicle_category || 'vehicle'}. Price range: $${data.price_range_min || '?'} - $${data.price_range_max || '?'}`,
        status: 'pending',
        priority: 'normal',
        submission_id: submission.id,
        auto_generated: true,
      })
    } catch (taskErr) {
      console.error('Task create error:', taskErr)
    }

    // =========================================================================
    // 4. Send notification SMS to business
    // =========================================================================
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fwg-ops.vercel.app'
      const vehicleDesc = [data.vehicle_year, data.vehicle_make, data.vehicle_model]
        .filter(Boolean).join(' ') || data.vehicle_category || 'Vehicle'
      const priceRange = data.price_range_min && data.price_range_max
        ? `$${Number(data.price_range_min).toLocaleString()} - $${Number(data.price_range_max).toLocaleString()}`
        : 'N/A'

      await fetch(`${appUrl}/api/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: '+12406933715',
          message: `New Estimator Submission!\n${data.customer_name}\n${vehicleDesc} - ${data.project_type || 'Wrap'}\nRange: ${priceRange}\nPhone: ${data.customer_phone}`
        })
      })
    } catch (smsErr) {
      console.error('SMS notification error:', smsErr)
    }

    // =========================================================================
    // 5. Return success
    // =========================================================================
    return NextResponse.json({
      ok: true,
      submission_id: submission.id,
      submission_number: submission.submission_number,
      message: 'Submission received! We will be in touch shortly.'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('Estimator submit error:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to submit. Please try again or call us directly.' },
      { status: 500, headers: corsHeaders }
    )
  }
}
