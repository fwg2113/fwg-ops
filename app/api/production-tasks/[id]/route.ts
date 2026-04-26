import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

// PATCH — update task fields
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id } = await params
  try {
    const body = await req.json()
    const updates: Record<string, any> = {}
    const allowed = [
      'title', 'description',
      'production_stage', 'production_sort_order',
      'production_status_id', 'production_status_note',
      'due_date', 'leader_id',
      'archived', 'archived_at',
      'task_completed_at',
      'mockups', 'notes_log',
      'calendar_event_id',
    ]
    for (const k of allowed) if (k in body) updates[k] = body[k]
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
    }

    // If stage is changing, apply default-on-entry status (unless caller already passed one)
    if ('production_stage' in updates && !('production_status_id' in updates)) {
      const stage = updates.production_stage
      if (stage !== 'COMPLETE') {
        const { data: defStatus } = await supabase
          .from('production_statuses')
          .select('id')
          .eq('stage_key', stage)
          .eq('is_default_on_entry', true)
          .eq('active', true)
          .maybeSingle()
        updates.production_status_id = defStatus?.id || null
        updates.production_status_note = null
      } else {
        updates.production_status_id = null
        updates.production_status_note = null
      }
    }

    // Auto-set task_completed_at when moving to COMPLETE for the first time
    if ('production_stage' in updates && updates.production_stage === 'COMPLETE') {
      const { data: existing } = await supabase
        .from('production_tasks')
        .select('task_completed_at')
        .eq('id', id)
        .maybeSingle()
      if (!existing?.task_completed_at) updates.task_completed_at = new Date().toISOString()
    }

    // Auto-set archived_at when archiving
    if (updates.archived === true && !('archived_at' in updates)) {
      updates.archived_at = new Date().toISOString()
    }
    if (updates.archived === false) {
      updates.archived_at = null
    }

    const { data, error } = await supabase
      .from('production_tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// DELETE — hard delete (use archive for soft)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id } = await params
  const { error } = await supabase.from('production_tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
