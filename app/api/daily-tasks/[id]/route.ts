import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id } = await params
  try {
    const body = await req.json()
    const updates: Record<string, any> = {}
    const allowed = [
      'title', 'description',
      'scheduled_date', 'is_priority',
      'parent_document_id', 'status',
      'sort_order',
    ]
    for (const k of allowed) if (k in body) updates[k] = body[k]
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
    }

    // Auto-set completed_at when status flips to DONE
    if ('status' in updates) {
      if (updates.status === 'DONE') updates.completed_at = new Date().toISOString()
      if (updates.status === 'TODO') updates.completed_at = null
    }

    const { data, error } = await supabase
      .from('daily_tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id } = await params
  const { error } = await supabase.from('daily_tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
