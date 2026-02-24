import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { notes, photo_url, completed_by_ids } = body

  // Look up names for the selected team members
  let completedByNames: string | null = null
  let primaryCompleterId: string | null = null
  const namesList: string[] = []

  if (completed_by_ids?.length) {
    primaryCompleterId = completed_by_ids[0]
    const { data: members } = await supabase
      .from('nih_team_members')
      .select('id, name')
      .in('id', completed_by_ids)
    if (members?.length) {
      const nameMap = new Map(members.map(m => [m.id, m.name]))
      completed_by_ids.forEach((cid: string) => {
        const name = nameMap.get(cid)
        if (name) namesList.push(name)
      })
      completedByNames = namesList.join(', ')
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

  // Distribute points to team members
  let pointsPerPerson = 0

  if (task.points > 0 && completed_by_ids?.length) {
    const basePoints = Math.floor(task.points / completed_by_ids.length)
    const remainder = task.points - basePoints * completed_by_ids.length

    for (let i = 0; i < completed_by_ids.length; i++) {
      const memberId = completed_by_ids[i]
      const pts = basePoints + (i < remainder ? 1 : 0)

      if (pts > 0) {
        // Get current points then increment
        const { data: member } = await supabase
          .from('nih_team_members')
          .select('total_points')
          .eq('id', memberId)
          .single()

        await supabase
          .from('nih_team_members')
          .update({ total_points: (member?.total_points || 0) + pts })
          .eq('id', memberId)
      }
    }

    pointsPerPerson = basePoints + (remainder > 0 ? 1 : 0)
  }

  // Log this completion permanently in the completions history table
  const completedAt = new Date().toISOString()
  await supabase
    .from('nih_task_completions')
    .insert({
      task_id: id,
      task_title: task.title,
      completion_notes: notes || null,
      completion_photo_url: photo_url || null,
      completed_at: completedAt,
      completed_by_names: completedByNames,
      points_awarded: task.points || 0,
    })

  return NextResponse.json({
    ...task,
    points_awarded: task.points > 0 && completed_by_ids?.length > 0,
    points_per_person: pointsPerPerson,
    points_names: namesList,
    points_total: task.points,
  })
}
