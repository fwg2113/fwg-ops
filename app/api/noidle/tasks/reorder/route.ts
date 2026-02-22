import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function POST(req: Request) {
  const body = await req.json()
  const { orderedIds } = body as { orderedIds: string[] }

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: 'orderedIds array is required' }, { status: 400 })
  }

  // Batch update sort_order for each task
  const updates = orderedIds.map((id, index) =>
    supabase
      .from('nih_tasks')
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq('id', id)
  )

  const results = await Promise.all(updates)
  const failed = results.find(r => r.error)
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
