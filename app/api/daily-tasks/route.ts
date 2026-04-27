import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

// GET — list tasks. Optional filters: ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=TODO|DONE
export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const status = searchParams.get('status')

  let q = supabase.from('daily_tasks').select('*').order('sort_order', { ascending: true })
  if (from) q = q.gte('scheduled_date', from)
  if (to) q = q.lte('scheduled_date', to)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST — create task
export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const body = await req.json()
    // Strip literal "\n" (backslash + n) leftover from old production_pipeline_configs labels
    const title = String(body.title || '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim()
    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

    // Compute next sort_order for the bucket (scheduled_date + is_priority combo)
    let sort_order = 0
    if (body.scheduled_date || body.is_priority) {
      const { data: existing } = await supabase
        .from('daily_tasks')
        .select('sort_order')
        .eq(body.is_priority ? 'is_priority' : 'scheduled_date', body.is_priority ? true : body.scheduled_date)
        .eq('status', 'TODO')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existing?.sort_order != null) sort_order = existing.sort_order + 10
    }

    const insert = {
      title,
      description: body.description || null,
      scheduled_date: body.scheduled_date || null,
      is_priority: !!body.is_priority,
      parent_document_id: body.parent_document_id || null,
      status: 'TODO',
      sort_order,
      source: body.source || 'manual',
      recurring_task_id: body.recurring_task_id || null,
    }

    const { data, error } = await supabase
      .from('daily_tasks')
      .insert(insert)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
