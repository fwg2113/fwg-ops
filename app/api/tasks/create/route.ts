import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, description, priority, due_date, status, notes, parent_task_id, task_leader_id, attachments } = body

    const insertData: any = {
      title,
      description: description || null,
      priority,
      due_date: due_date || null,
      status: status || 'TO_DO',
      notes: notes || null,
      parent_task_id: parent_task_id || null,
      created_at: new Date().toISOString()
    }
    if (task_leader_id) insertData.task_leader_id = task_leader_id
    if (attachments && attachments.length > 0) insertData.attachments = attachments

    const { data, error } = await supabase
      .from('tasks')
      .insert([insertData])
      .select('*')
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
