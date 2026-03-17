import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export const dynamic = 'force-dynamic'

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

  // Get current prizes so we can snapshot them with the winners
  const { data: prizes } = await supabase
    .from('nih_prizes')
    .select('position, prize_text')
    .order('position', { ascending: true })

  const prizeMap: Record<number, string> = {}
  if (prizes) {
    prizes.forEach(p => {
      prizeMap[p.position] = p.prize_text || ''
    })
  }

  // Calculate the week range
  // This runs at midnight Monday, so "this week" is the one that just ended:
  // weekStart = previous Monday, weekEnd = previous Sunday
  const now = new Date()
  const dayOfWeek = now.getUTCDay() // 0=Sun, 1=Mon, ...

  // If running on Monday (day 1), the week that just ended is:
  //   Monday = 7 days ago, Sunday = 1 day ago
  // For any other day, calculate accordingly
  const daysBackToMonday = dayOfWeek === 0 ? 6 : dayOfWeek === 1 ? 7 : dayOfWeek - 1

  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - daysBackToMonday)
  weekStart.setUTCHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6) // Sunday

  const weekStartStr = weekStart.toISOString().split('T')[0]
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  // Check if we already archived winners for this week (prevent double-run)
  const { data: existing } = await supabase
    .from('nih_weekly_winners')
    .select('id')
    .eq('week_start', weekStartStr)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({
      message: 'Weekly reset already ran for this week',
      week: { start: weekStartStr, end: weekEndStr },
      skipped: true,
    })
  }

  // Archive top 3 winners with prize text snapshot
  if (topMembers && topMembers.length > 0) {
    const winners = topMembers.map((member, i) => ({
      week_start: weekStartStr,
      week_end: weekEndStr,
      position: i + 1,
      team_member_id: member.id,
      member_name: member.name,
      member_avatar_color: member.avatar_color,
      points: member.total_points,
      prize_text: prizeMap[i + 1] || null,
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
