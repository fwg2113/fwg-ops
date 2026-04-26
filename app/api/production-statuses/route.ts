import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

// GET — list all active statuses (optionally filtered by stage)
export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const stage = searchParams.get('stage')

  let q = supabase
    .from('production_statuses')
    .select('*')
    .eq('active', true)
    .order('stage_key', { ascending: true })
    .order('sort_order', { ascending: true })

  if (stage) q = q.eq('stage_key', stage)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST — create a new status in a stage
export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const body = await req.json()
    const stage_key = body.stage_key as string
    if (!stage_key || !['QUEUE', 'DESIGN', 'PRINT', 'PRODUCTION'].includes(stage_key)) {
      return NextResponse.json({ error: 'Invalid stage_key' }, { status: 400 })
    }
    const label = (body.label || '').trim()
    if (!label) return NextResponse.json({ error: 'Label required' }, { status: 400 })

    // If is_default_on_entry, clear any existing default for this stage
    if (body.is_default_on_entry) {
      await supabase
        .from('production_statuses')
        .update({ is_default_on_entry: false })
        .eq('stage_key', stage_key)
        .eq('is_default_on_entry', true)
    }

    // Compute next sort_order
    const { data: maxRow } = await supabase
      .from('production_statuses')
      .select('sort_order')
      .eq('stage_key', stage_key)
      .eq('active', true)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextSort = (maxRow?.sort_order ?? -1) + 1

    const { data, error } = await supabase
      .from('production_statuses')
      .insert({
        stage_key,
        label,
        color: body.color || '#64748b',
        sort_order: body.sort_order ?? nextSort,
        requires_note: !!body.requires_note,
        is_default_on_entry: !!body.is_default_on_entry,
        special_action: body.special_action || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
