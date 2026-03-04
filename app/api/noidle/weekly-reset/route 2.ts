import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST() {
  // Get the top 3 members by points (only those with > 0 points)
  const { data: topMembers, error: fetchError } = await supabase
    .from('nih_team_members')
    .select('id, name, avatar_color, total_points')
    .eq('is_active', true)
    .gt('total_points', 0)
    .order('total_points', { ascending: false })
    .limit(3)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  // Calculate the week range (previous Monday to Sunday)
  const now = new Date()
  const dayOfWeek = now.getDay()
  // Get the Monday that just ended (previous Monday)
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekEnd = new Date(now)
  weekEnd.setDate(now.getDate() - mondayOffset)
  weekEnd.setHours(0, 0, 0, 0)
  // Subtract 1 day to get Sunday (end of previous week)
  const weekEndSunday = new Date(weekEnd)
  weekEndSunday.setDate(weekEnd.getDate() - 1)
  const weekStart = new Date(weekEndSunday)
  weekStart.setDate(weekEndSunday.getDate() - 6)

  const weekStartStr = weekStart.toISOString().split('T')[0]
  const weekEndStr = weekEndSunday.toISOString().split('T')[0]

  // Archive top 3 winners
  if (topMembers && topMembers.length > 0) {
    const winners = topMembers.map((member, i) => ({
      week_start: weekStartStr,
      week_end: weekEndStr,
      position: i + 1,
      team_member_id: member.id,
      member_name: member.name,
      member_avatar_color: member.avatar_color,
      points: member.total_points,
    }))

    const { error: insertError } = await supabase
      .from('nih_weekly_winners')
      .upsert(winners, { onConflict: 'week_start,position' })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  // Reset all team member points to 0
  const { error: resetError } = await supabase
    .from('nih_team_members')
    .update({ total_points: 0 })
    .eq('is_active', true)

  if (resetError) {
    return NextResponse.json({ error: resetError.message }, { status: 500 })
  }

  // Return the updated team members
  const { data: updated, error: updatedError } = await supabase
    .from('nih_team_members')
    .select('id, name, avatar_color, total_points')
    .eq('is_active', true)
    .order('total_points', { ascending: false })

  if (updatedError) {
    return NextResponse.json({ error: updatedError.message }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Weekly reset complete',
    archived_winners: topMembers?.length || 0,
    week: { start: weekStartStr, end: weekEndStr },
    members: updated,
  })
}
