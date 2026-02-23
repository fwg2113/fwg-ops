import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * POST /api/noidle/tasks/reset-recurring
 * Resets completed recurring tasks that are scheduled for today back to 'open'.
 * Intended to be called by a daily cron job at midnight (or start of day).
 */
export async function POST() {
  const today = DAY_NAMES[new Date().getDay()]

  // Find recurring tasks that were completed and are scheduled for today
  const { data: tasks, error } = await supabase
    .from('nih_tasks')
    .select('id')
    .eq('is_recurring', true)
    .eq('status', 'completed')
    .contains('recurring_days', [today])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!tasks?.length) {
    return NextResponse.json({ reset: 0, day: today })
  }

  const ids = tasks.map(t => t.id)

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
    .in('id', ids)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ reset: ids.length, day: today })
}
