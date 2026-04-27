import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('recurring_tasks')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const body = await req.json()
    const title = (body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })
    const pattern = body.pattern as string
    if (!pattern) return NextResponse.json({ error: 'pattern required' }, { status: 400 })

    const { data, error } = await supabase
      .from('recurring_tasks')
      .insert({
        title,
        description: body.description || null,
        pattern,
        default_assignee_id: body.default_assignee_id || null,
        default_priority: !!body.default_priority,
        active: true,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
