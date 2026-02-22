import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { notes, photo_url } = body

  const { data: task, error } = await supabase
    .from('nih_tasks')
    .update({
      status: 'completed',
      completion_notes: notes || null,
      completion_photo_url: photo_url || null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(task)
}
