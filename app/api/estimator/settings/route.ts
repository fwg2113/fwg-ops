import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [vehiclesRes, projectsRes, scenariosRes, pricingRes, feesRes] = await Promise.all([
      supabase.from('estimator_vehicle_categories').select('*').order('sort_order'),
      supabase.from('estimator_project_types').select('*').order('sort_order'),
      supabase.from('estimator_design_scenarios').select('*').order('sort_order'),
      supabase.from('estimator_pricing').select('*').order('category_key').order('project_key'),
      supabase.from('estimator_design_fees').select('*').order('category_key').order('scenario_key'),
    ]);

    return NextResponse.json({
      ok: true,
      vehicleCategories: vehiclesRes.data || [],
      projectTypes: projectsRes.data || [],
      designScenarios: scenariosRes.data || [],
      pricingMatrix: pricingRes.data || [],
      designFees: feesRes.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { table, id, data } = body;

    if (!table || !id || !data) {
      return NextResponse.json({ ok: false, error: 'table, id, and data required' }, { status: 400 });
    }

    const allowed = [
      'estimator_vehicle_categories',
      'estimator_project_types',
      'estimator_design_scenarios',
      'estimator_pricing',
      'estimator_design_fees',
    ];
    if (!allowed.includes(table)) {
      return NextResponse.json({ ok: false, error: 'Invalid table' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: updated, error } = await supabase.from(table).update(data).eq('id', id).select().single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, record: updated });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { table, data } = body;

    if (!table || !data) {
      return NextResponse.json({ ok: false, error: 'table and data required' }, { status: 400 });
    }

    const allowed = [
      'estimator_vehicle_categories',
      'estimator_project_types',
      'estimator_design_scenarios',
      'estimator_pricing',
      'estimator_design_fees',
    ];
    if (!allowed.includes(table)) {
      return NextResponse.json({ ok: false, error: 'Invalid table' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: created, error } = await supabase.from(table).insert(data).select().single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, record: created });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const id = searchParams.get('id');

    if (!table || !id) {
      return NextResponse.json({ ok: false, error: 'table and id required' }, { status: 400 });
    }

    const allowed = [
      'estimator_vehicle_categories',
      'estimator_project_types',
      'estimator_design_scenarios',
      'estimator_pricing',
      'estimator_design_fees',
    ];
    if (!allowed.includes(table)) {
      return NextResponse.json({ ok: false, error: 'Invalid table' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { error } = await supabase.from(table).delete().eq('id', id);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
