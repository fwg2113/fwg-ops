import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { notes, photo_url, completed_by_ids } = body

  // Look up names for the selected team members
  let completedByNames: string | null = null
  let primaryCompleterId: string | null = null

  if (completed_by_ids?.length) {
    primaryCompleterId = completed_by_ids[0]
    const { data: members } = await supabase
      .from('nih_team_members')
      .select('id, name')
      .in('id', completed_by_ids)
    if (members?.length) {
      // Preserve selection order
      const nameMap = new Map(members.map(m => [m.id, m.name]))
      completedByNames = completed_by_ids
        .map((cid: string) => nameMap.get(cid))
        .filter(Boolean)
        .join(', ')
    }
  }

  const { data: task, error } = await supabase
    .from('nih_tasks')
    .update({
      status: 'completed',
      completion_notes: notes || null,
      completion_photo_url: photo_url || null,
      completed_at: new Date().toISOString(),
      completed_by: primaryCompleterId,
      completed_by_names: completedByNames,
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
