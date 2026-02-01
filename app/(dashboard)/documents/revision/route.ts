import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  const { documentId, message, name } = await request.json()

  if (!documentId || !message) {
    return NextResponse.json({ error: 'Missing documentId or message' }, { status: 400 })
  }

  try {
    // Get current document
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('revision_history_json, customer_phone')
      .eq('id', documentId)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Parse existing revision history
    let revisions = []
    try {
      revisions = Array.isArray(doc.revision_history_json) 
        ? doc.revision_history_json 
        : JSON.parse(doc.revision_history_json || '[]')
    } catch {
      revisions = []
    }

    // Add new revision request
    const newRevision = {
      timestamp: new Date().toISOString(),
      from: 'customer',
      name: name || 'Customer',
      message: message.trim()
    }
    revisions.push(newRevision)

    // Update document
    const { error: updateError } = await supabase
      .from('documents')
      .update({ 
        revision_history_json: revisions,
        status: 'revision_requested'
      })
      .eq('id', documentId)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to save revision request' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Revision error:', error)
    return NextResponse.json({ error: 'Failed to submit revision' }, { status: 500 })
  }
}