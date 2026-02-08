import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Submission fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch submission' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const updates = await request.json()

    // Only allow updating specific fields
    const allowed = ['status', 'notes', 'assigned_to', 'last_contact_at', 'next_followup_at']
    const filtered: Record<string, unknown> = {}
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        filtered[key] = updates[key]
      }
    }

    const { data, error } = await supabase
      .from('submissions')
      .update(filtered)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, submission: data })
  } catch (error) {
    console.error('Submission update error:', error)
    return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 })
  }
}
