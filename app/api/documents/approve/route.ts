import { NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'

export async function POST(request: Request) {
  try {
    const { documentId, convertToInvoice = true } = await request.json()
    
    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
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

    // Prepare update data
    const updateData: any = {
      status: 'approved',
      approved_at: new Date().toISOString()
    }

    // If it's a quote and we should convert to invoice
    if (doc.doc_type === 'quote' && convertToInvoice) {
      // Get next invoice number
      const { data: lastInvoice } = await supabase
        .from('documents')
        .select('doc_number')
        .eq('doc_type', 'invoice')
        .order('doc_number', { ascending: false })
        .limit(1)
        .single()

      const nextInvoiceNumber = (lastInvoice?.doc_number || 1000) + 1

      updateData.doc_type = 'invoice'
      updateData.doc_number = nextInvoiceNumber
      updateData.balance_due = doc.total - (doc.amount_paid || 0)
    }

    // Update the document
    const { data, error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      document: data,
      converted: doc.doc_type === 'quote' && convertToInvoice
    })
  } catch (error) {
    console.error('Approve error:', error)
    return NextResponse.json({ error: 'Failed to approve document' }, { status: 500 })
  }
}