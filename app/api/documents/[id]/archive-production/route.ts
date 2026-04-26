import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

// PATCH — archive or restore a document's production-board card.
// This does NOT touch the underlying invoice — only the board card.
// Body: { archived: boolean }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id } = await params
  const { archived } = await req.json()
  if (typeof archived !== 'boolean') {
    return NextResponse.json({ error: 'archived (boolean) required' }, { status: 400 })
  }
  const updates: Record<string, any> = {
    production_archived: archived,
    production_archived_at: archived ? new Date().toISOString() : null,
  }
  const { error } = await supabase.from('documents').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
