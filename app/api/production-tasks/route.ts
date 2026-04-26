import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

const STAGE_KEYS = ['QUEUE', 'DESIGN', 'PRINT', 'PRODUCTION', 'COMPLETE']

// GET — list active (non-archived) board tasks
export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const includeArchived = searchParams.get('archived') === 'true'

  let q = supabase
    .from('production_tasks')
    .select('*')
    .not('title', 'is', null) // exclude legacy non-board rows
    .order('production_sort_order', { ascending: true })

  if (!includeArchived) q = q.eq('archived', false)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST — create new board task
export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const body = await req.json()
    const title = (body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

    const stage = STAGE_KEYS.includes(body.production_stage) ? body.production_stage : 'QUEUE'

    // Apply default-on-entry status for the stage
    let status_id: string | null = body.production_status_id ?? null
    if (!status_id && stage !== 'COMPLETE') {
      const { data: defStatus } = await supabase
        .from('production_statuses')
        .select('id')
        .eq('stage_key', stage)
        .eq('is_default_on_entry', true)
        .eq('active', true)
        .maybeSingle()
      if (defStatus) status_id = defStatus.id
    }

    const insert = {
      title,
      description: body.description || null,
      production_stage: stage,
      production_sort_order: 0,
      production_status_id: status_id,
      production_status_note: body.production_status_note || null,
      due_date: body.due_date || null,
      leader_id: body.leader_id || null,
      mockups: [],
      notes_log: [],
      calendar_event_id: body.calendar_event_id || null,
    }

    const { data, error } = await supabase
      .from('production_tasks')
      .insert(insert)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
