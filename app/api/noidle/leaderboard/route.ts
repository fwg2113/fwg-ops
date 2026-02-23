import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('nih_team_members')
    .select('id, name, avatar_color, total_points')
    .eq('is_active', true)
    .gt('total_points', 0)
    .order('total_points', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
