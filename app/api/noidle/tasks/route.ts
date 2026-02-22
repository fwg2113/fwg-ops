import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('nih_tasks')
    .select('*, nih_categories(*), nih_locations(*), nih_task_assignees(nih_team_members(*))')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { title, description, category_id, location_id, urgency, time_estimate, is_project, parent_id, point_of_contact, assignee_ids } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  // Get max sort_order for positioning
  const { data: maxSort } = await supabase
    .from('nih_tasks')
    .select('sort_order')
    .is('parent_id', parent_id || null)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSort = (maxSort?.[0]?.sort_order ?? -1) + 1

  const { data: task, error } = await supabase
    .from('nih_tasks')
    .insert({
      title: title.trim(),
      description: description || null,
      category_id: category_id || null,
      location_id: location_id || null,
      urgency: urgency || 'medium',
      time_estimate: time_estimate || null,
      is_project: is_project || false,
      parent_id: parent_id || null,
      point_of_contact: point_of_contact || null,
      sort_order: nextSort,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Add assignees if provided
  if (assignee_ids?.length && task) {
    const assigneeRows = assignee_ids.map((memberId: string) => ({
      task_id: task.id,
      team_member_id: memberId,
    }))
    await supabase.from('nih_task_assignees').insert(assigneeRows)
  }

  return NextResponse.json(task, { status: 201 })
}
