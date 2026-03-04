import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET() {
  const [tasksRes, leadersRes] = await Promise.all([
    supabase
      .from('nih_tasks')
      .select('points')
      .is('parent_id', null)
      .in('status', ['open', 'in_progress']),
    supabase
      .from('nih_team_members')
      .select('id, name, avatar_color, total_points')
      .eq('is_active', true)
      .gt('total_points', 0)
      .order('total_points', { ascending: false })
      .limit(3),
  ])

  if (tasksRes.error || leadersRes.error) {
    return NextResponse.json(
      { error: tasksRes.error?.message || leadersRes.error?.message },
      { status: 500 }
    )
  }

  const availablePoints = (tasksRes.data || []).reduce((sum, t) => sum + (t.points || 0), 0)

  return NextResponse.json({
    availablePoints,
    leaders: leadersRes.data || [],
  })
}
