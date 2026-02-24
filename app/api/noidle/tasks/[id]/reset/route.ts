import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

/**
 * POST /api/noidle/tasks/[id]/reset
 * Manually resets a single recurring task back to 'open'.
 * Used when a task needs to be done again the same day (e.g., trash goes out twice).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Verify task exists and is recurring
  const { data: task, error: fetchError } = await supabase
    .from('nih_tasks')
    .select('id, is_recurring, status')
    .eq('id', id)
    .single()

  if (fetchError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  if (!task.is_recurring) {
    return NextResponse.json({ error: 'Task is not a recurring task' }, { status: 400 })
  }

  if (task.status !== 'completed') {
    return NextResponse.json({ error: 'Task is not completed' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('nih_tasks')
    .update({
      status: 'open',
      completion_notes: null,
      completion_photo_url: null,
      completed_at: null,
      completed_by: null,
      completed_by_names: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, reset: id })
}
