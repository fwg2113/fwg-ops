import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * POST /api/noidle/tasks/reset-recurring
 * Resets completed recurring tasks that are scheduled for today back to 'open'.
 * Only resets tasks that were completed BEFORE today (so same-day completions are preserved).
 * Called automatically on page load and can also be triggered by a cron job.
 */
export async function POST() {
  const now = new Date()
  const today = DAY_NAMES[now.getDay()]

  // Start of today in ISO format (midnight local server time)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  // Find recurring tasks that:
  // 1. Are marked as recurring
  // 2. Are currently completed
  // 3. Are scheduled for today
  // 4. Were completed BEFORE today (not same-day completions)
  const { data: tasks, error } = await supabase
    .from('nih_tasks')
    .select('id')
    .eq('is_recurring', true)
    .eq('status', 'completed')
    .contains('recurring_days', [today])
    .lt('completed_at', startOfToday)

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
