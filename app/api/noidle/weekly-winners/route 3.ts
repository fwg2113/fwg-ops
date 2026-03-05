import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET() {
  // Get the most recent week's winners
  const { data, error } = await supabase
    .from('nih_weekly_winners')
    .select('*')
    .order('week_start', { ascending: false })
    .order('position', { ascending: true })
    .limit(3)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Only return winners from the same week (most recent)
  if (data && data.length > 0) {
    const latestWeek = data[0].week_start
    const weekWinners = data.filter(d => d.week_start === latestWeek)
    return NextResponse.json(weekWinners)
  }

  return NextResponse.json([])
}
