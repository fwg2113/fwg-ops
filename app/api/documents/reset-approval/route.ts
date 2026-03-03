import { supabase } from '@/app/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { documentId, reason } = await request.json()

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
    }

    // Fetch document to verify it exists and is approved
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('id, approved_at, status, doc_type')
      .eq('id', documentId)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (!doc.approved_at) {
      return NextResponse.json({ error: 'Document is not approved' }, { status: 400 })
    }

    // Reset approval: revert to quote, unlock pricing, set status to sent
    const { error } = await supabase
      .from('documents')
      .update({
        approved_at: null,
        status: 'sent',
        doc_type: 'quote',
        pricing_locked: false
      })
      .eq('id', documentId)

    if (error) {
      console.error('Reset approval error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Reset approval error:', err)
    const message = err instanceof Error ? err.message : 'Failed to reset approval'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
