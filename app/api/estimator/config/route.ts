import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [vehiclesRes, projectsRes, scenariosRes, pricingRes, feesRes] = await Promise.all([
      supabase.from('estimator_vehicle_categories').select('*').eq('active', true).order('sort_order'),
      supabase.from('estimator_project_types').select('*').eq('active', true).order('sort_order'),
      supabase.from('estimator_design_scenarios').select('*').eq('active', true).order('sort_order'),
      supabase.from('estimator_pricing').select('*'),
      supabase.from('estimator_design_fees').select('*'),
    ]);

    const response = NextResponse.json({
      ok: true,
      vehicleCategories: vehiclesRes.data || [],
      projectTypes: projectsRes.data || [],
      designScenarios: scenariosRes.data || [],
      pricingMatrix: pricingRes.data || [],
      designFees: feesRes.data || [],
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET');
    return response;
  } catch (err: any) {
    console.error('Estimator config error:', err);
    const response = NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
