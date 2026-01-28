import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  try {
    const { documentId } = await request.json()

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
    }

    // Update the document status to approved
    const { data, error } = await supabase
      .from('documents')
      .update({ status: 'approved' })
      .eq('id', documentId)
      .select()
      .single()

    if (error) {
      console.error('Error approving document:', error)
      return NextResponse.json({ error: 'Failed to approve document' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, document: data })
  } catch (error) {
    console.error('Error in approve API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
