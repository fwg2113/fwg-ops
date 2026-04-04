import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET — fetch notes for a document
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabase
    .from('documents')
    .select('notes')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const notes = Array.isArray(data?.notes) ? data.notes : []
  return NextResponse.json(notes)
}

// POST — add a new note
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { text, author } = body
  if (!text?.trim()) return NextResponse.json({ error: 'Text required' }, { status: 400 })

  // Fetch current notes
  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('notes')
    .eq('id', id)
    .single()
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  const existing = Array.isArray(doc?.notes) ? doc.notes : []
  const newNote = {
    text: text.trim(),
    author: author || 'Unknown',
    at: new Date().toISOString(),
  }
  const updated = [newNote, ...existing]

  const { error: updateErr } = await supabase
    .from('documents')
    .update({ notes: updated })
    .eq('id', id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json(updated)
}
