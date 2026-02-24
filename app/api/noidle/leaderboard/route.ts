import { NextRequest, NextResponse } from 'next/server'
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

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { members } = body as { members: { id: string; total_points: number }[] }

  if (!members || !Array.isArray(members)) {
    return NextResponse.json({ error: 'members array required' }, { status: 400 })
  }

  for (const m of members) {
    const { error } = await supabase
      .from('nih_team_members')
      .update({ total_points: Math.max(0, m.total_points) })
      .eq('id', m.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { data, error } = await supabase
    .from('nih_team_members')
    .select('id, name, avatar_color, total_points')
    .eq('is_active', true)
    .order('total_points', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
