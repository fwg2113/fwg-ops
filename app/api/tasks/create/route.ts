import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, description, priority, due_date, status, notes } = body

    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        title,
        description,
        priority,
        due_date: due_date || null,
        status: status || 'TO_DO',
        notes: notes || null,
        created_at: new Date().toISOString()
      }])
      .select()
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
