import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET — fetch assignments for a document
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabase
    .from('production_assignments')
    .select('document_id, team_member_id')
    .eq('document_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST — add assignment
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { team_member_id } = await req.json()
  if (!team_member_id) return NextResponse.json({ error: 'team_member_id required' }, { status: 400 })

  const { error } = await supabase
    .from('production_assignments')
    .upsert({ document_id: id, team_member_id }, { onConflict: 'document_id,team_member_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE — remove assignment
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { team_member_id } = await req.json()
  if (!team_member_id) return NextResponse.json({ error: 'team_member_id required' }, { status: 400 })

  const { error } = await supabase
    .from('production_assignments')
    .delete()
    .eq('document_id', id)
    .eq('team_member_id', team_member_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
