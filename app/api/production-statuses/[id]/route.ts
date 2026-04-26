import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

// PATCH — update label, color, requires_note, is_default_on_entry, sort_order, special_action, active
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id } = await params
  try {
    const body = await req.json()
    const updates: Record<string, any> = {}
    const allowed = ['label', 'color', 'sort_order', 'requires_note', 'is_default_on_entry', 'special_action', 'active']
    for (const k of allowed) if (k in body) updates[k] = body[k]

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
    }

    // If setting default-on-entry, clear any other default for the same stage
    if (updates.is_default_on_entry === true) {
      const { data: row } = await supabase
        .from('production_statuses')
        .select('stage_key')
        .eq('id', id)
        .single()
      if (row?.stage_key) {
        await supabase
          .from('production_statuses')
          .update({ is_default_on_entry: false })
          .eq('stage_key', row.stage_key)
          .eq('is_default_on_entry', true)
          .neq('id', id)
      }
    }

    const { data, error } = await supabase
      .from('production_statuses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// DELETE — soft-delete (active=false). Any docs pointing at it will keep the FK but display fallback.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id } = await params
  const { error } = await supabase
    .from('production_statuses')
    .update({ active: false, is_default_on_entry: false })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
