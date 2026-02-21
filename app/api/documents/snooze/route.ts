import { supabase } from '@/app/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { id, type, snoozed } = await request.json()

    if (!id || !type || typeof snoozed !== 'boolean') {
      return NextResponse.json({ error: 'Missing id, type, or snoozed' }, { status: 400 })
    }

    const table = type === 'submission' ? 'submissions' : 'documents'
    const update: any = {
      snoozed,
      snoozed_at: snoozed ? new Date().toISOString() : null,
    }

    const { error } = await supabase.from(table).update(update).eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
