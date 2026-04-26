import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id } = await params
  const { team_member_id } = await req.json()
  if (!team_member_id) return NextResponse.json({ error: 'team_member_id required' }, { status: 400 })

  const { error } = await supabase
    .from('production_task_assignments')
    .upsert({ task_id: id, team_member_id }, { onConflict: 'task_id,team_member_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id } = await params
  const { team_member_id } = await req.json()
  if (!team_member_id) return NextResponse.json({ error: 'team_member_id required' }, { status: 400 })

  const { error } = await supabase
    .from('production_task_assignments')
    .delete()
    .eq('task_id', id)
    .eq('team_member_id', team_member_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
