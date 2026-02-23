import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('nih_prizes')
    .select('*')
    .order('position', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const body = await req.json()
  const { prizes } = body

  if (!Array.isArray(prizes)) {
    return NextResponse.json({ error: 'prizes array is required' }, { status: 400 })
  }

  for (const prize of prizes) {
    const { error } = await supabase
      .from('nih_prizes')
      .update({ prize_text: prize.prize_text, updated_at: new Date().toISOString() })
      .eq('position', prize.position)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { data } = await supabase
    .from('nih_prizes')
    .select('*')
    .order('position', { ascending: true })

  return NextResponse.json(data)
}
