import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { title, description, category_id, location_id, urgency, time_estimate, status, is_project, point_of_contact, assignee_ids, completed_at, completion_notes, completed_by, points, is_recurring, recurring_days } = body

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
  if (points !== undefined) updates.points = points
  if (is_recurring !== undefined) updates.is_recurring = is_recurring
  if (recurring_days !== undefined) updates.recurring_days = recurring_days

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

  // Get the task to check for points that need to be reversed
  const { data: task } = await supabase
    .from('nih_tasks')
    .select('points, status, completed_by, completed_by_names')
    .eq('id', id)
    .single()

  // If task was completed with points, reverse them from the completer
  if (task?.status === 'completed' && task.points > 0 && task.completed_by) {
    // Find all team members mentioned in completed_by_names
    const names = task.completed_by_names?.split(', ') || []
    const completerIds: string[] = []

    if (names.length > 1) {
      // Multiple completers — look up their IDs by name
      const { data: members } = await supabase
        .from('nih_team_members')
        .select('id, name')
        .in('name', names)
      if (members?.length) {
        members.forEach(m => completerIds.push(m.id))
      }
    }

    // Always include the primary completer
    if (!completerIds.includes(task.completed_by)) {
      completerIds.push(task.completed_by)
    }

    // Reverse the same point distribution used during completion
    const basePoints = Math.floor(task.points / completerIds.length)
    const remainder = task.points - basePoints * completerIds.length

    for (let i = 0; i < completerIds.length; i++) {
      const pts = basePoints + (i < remainder ? 1 : 0)
      if (pts > 0) {
        const { data: member } = await supabase
          .from('nih_team_members')
          .select('total_points')
          .eq('id', completerIds[i])
          .single()

        await supabase
          .from('nih_team_members')
          .update({ total_points: Math.max(0, (member?.total_points || 0) - pts) })
          .eq('id', completerIds[i])
      }
    }
  }

  const { error } = await supabase
    .from('nih_tasks')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
