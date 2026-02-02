import { NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'

export async function POST(request: Request) {
  try {
    const { documentId, message, name, contactPreference } = await request.json()
    
    if (!documentId || !message) {
      return NextResponse.json({ error: 'Missing documentId or message' }, { status: 400 })
    }

    // Get current document
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Build revision history entry
    const revisionEntry = {
      from: 'customer',
      name: name || doc.customer_name,
      message: message,
      contactPreference: contactPreference || 'sms',
      timestamp: new Date().toISOString()
    }

    // Get existing revision history or create new array
    let revisionHistory: any[] = []
    if (doc.revision_history_json) {
      try {
        revisionHistory = typeof doc.revision_history_json === 'string' 
          ? JSON.parse(doc.revision_history_json) 
          : doc.revision_history_json
        if (!Array.isArray(revisionHistory)) {
          revisionHistory = []
        }
      } catch (e) {
        revisionHistory = []
      }
    }
    
    // Add new entry
    revisionHistory.push(revisionEntry)

    // Build note entry
    const timestamp = new Date().toLocaleString()
    const contactLabel = contactPreference === 'email' ? 'Email' : 'SMS'
    const revisionNote = `** REVISION REQUEST (${timestamp}) **\nContact via: ${contactLabel}\n${message}`
    const existingNotes = doc.notes || ''
    const updatedNotes = existingNotes ? revisionNote + '\n\n---\n\n' + existingNotes : revisionNote

    // Update document
    const { data, error } = await supabase
      .from('documents')
      .update({ 
        status: 'revision_requested',
        revision_history_json: revisionHistory,
        notes: updatedNotes
      })
      .eq('id', documentId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send SMS notification to business
    try {
      const smsContactLabel = contactPreference === 'email' ? '(prefers Email)' : '(prefers SMS)'
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://fwg-ops.vercel.app'}/api/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: '+12406933715',
          message: `Revision request for Quote #${doc.doc_number} from ${name || doc.customer_name} ${smsContactLabel}: ${message.substring(0, 80)}${message.length > 80 ? '...' : ''}`
        })
      })
    } catch (smsError) {
      console.error('SMS notification failed:', smsError)
    }

    return NextResponse.json({ success: true, document: data })
  } catch (error) {
    console.error('Revision request error:', error)
    return NextResponse.json({ error: 'Failed to submit revision' }, { status: 500 })
  }
}