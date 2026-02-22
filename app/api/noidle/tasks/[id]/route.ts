import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { title, description, category_id, location_id, urgency, time_estimate, status, is_project, point_of_contact, assignee_ids, completed_at, completion_notes, completed_by } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description
  if (category_id !== undefined) updates.category_id = category_id || null
  if (location_id !== undefined) updates.location_id = location_id || null
  if (urgency !== undefined) updates.urgency = urgency
  if (time_estimate !== undefined) updates.time_estimate = time_estimate || null
  if (status !== undefined) updates.status = status
  if (is_project !== undefined) updates.is_project = is_project
  if (point_of_contact !== undefined) updates.point_of_contact = point_of_contact || null
  if (completed_at !== undefined) updates.completed_at = completed_at
  if (completion_notes !== undefined) updates.completion_notes = completion_notes
  if (completed_by !== undefined) updates.completed_by = completed_by || null

  const { data: task, error } = await supabase
    .from('nih_tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update assignees if provided
  if (assignee_ids !== undefined) {
    await supabase.from('nih_task_assignees').delete().eq('task_id', id)
    if (assignee_ids.length) {
      const assigneeRows = assignee_ids.map((memberId: string) => ({
        task_id: id,
        team_member_id: memberId,
      }))
      await supabase.from('nih_task_assignees').insert(assigneeRows)
    }
  }

  return NextResponse.json(task)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { error } = await supabase
    .from('nih_tasks')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
