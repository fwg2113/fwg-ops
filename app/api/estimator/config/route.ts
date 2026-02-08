import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// CORS headers for cross-origin requests from Shopify
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET() {
  try {
    // Fetch all 5 reference tables in parallel
    const [
      vehicleRes,
      projectRes,
      scenarioRes,
      pricingRes,
      feesRes
    ] = await Promise.all([
      supabase
        .from('estimator_vehicle_categories')
        .select('category_key, label, size_factor, base_sqft_min, base_sqft_max, image_url, sort_order, notes')
        .eq('active', true)
        .order('sort_order'),
      supabase
        .from('estimator_project_types')
        .select('project_key, label, coverage_min_pct, coverage_max_pct, description, includes_design, sort_order')
        .eq('active', true)
        .order('sort_order'),
      supabase
        .from('estimator_design_scenarios')
        .select('scenario_key, label, description, design_fee_applies, requires_upload, sort_order, customer_message')
        .eq('active', true)
        .order('sort_order'),
      supabase
        .from('estimator_pricing_matrix')
        .select('category_key, project_key, price_min, price_max, typical_price, notes'),
      supabase
        .from('estimator_design_fees')
        .select('category_key, scenario_key, design_fee_min, design_fee_max, typical_fee')
    ])

    // Check for errors
    if (vehicleRes.error) throw new Error('Vehicle categories: ' + vehicleRes.error.message)
    if (projectRes.error) throw new Error('Project types: ' + projectRes.error.message)
    if (scenarioRes.error) throw new Error('Design scenarios: ' + scenarioRes.error.message)
    if (pricingRes.error) throw new Error('Pricing matrix: ' + pricingRes.error.message)
    if (feesRes.error) throw new Error('Design fees: ' + feesRes.error.message)

    return NextResponse.json({
      ok: true,
      vehicleCategories: vehicleRes.data || [],
      projectTypes: projectRes.data || [],
      designScenarios: scenarioRes.data || [],
      pricingMatrix: pricingRes.data || [],
      designFees: feesRes.data || []
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('Estimator config error:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to load estimator config' },
      { status: 500, headers: corsHeaders }
    )
  }
}
