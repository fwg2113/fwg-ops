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
    const color: string | null = body.project_color === null ? null : String(body.project_color || '').trim() || null

    if (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return NextResponse.json({ error: 'Invalid color format (expected #RRGGBB)' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('documents')
      .update({ project_color: color })
      .eq('id', id)
      .select('id, project_color')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
