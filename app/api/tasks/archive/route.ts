import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { taskIds } = body

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ error: 'No task IDs provided' }, { status: 400 })
    }

    console.log('[API /tasks/archive] Archiving tasks:', taskIds.length)

    // Update tasks to set archived = true
    const { data, error } = await supabase
      .from('tasks')
      .update({ archived: true })
      .in('id', taskIds)
      .select('id')

    if (error) {
      console.error('[API /tasks/archive] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[API /tasks/archive] Archived tasks successfully:', data?.length || 0)

    return NextResponse.json({
      success: true,
      archivedCount: data?.length || 0
    })
  } catch (error) {
    console.error('[API /tasks/archive] Error archiving tasks:', error)
    return NextResponse.json({ error: 'Failed to archive tasks' }, { status: 500 })
  }
}
