import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { autoCompleteActions } from '@/app/lib/customer/actionGenerator'

/**
 * Sync document payment status based on payments table
 * This recalculates amount_paid, balance_due, paid_at, and status
 * based on all payments for a document
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { documentId } = body

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
    }

    // Get the document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, total, amount_paid, balance_due')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Get all payments for this document
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount, processing_fee, payment_method, created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true })

    if (paymentsError) {
      return NextResponse.json({ error: paymentsError.message }, { status: 500 })
    }

    // Trigger the DB trigger to recalculate document payment status
    // by doing a touch-update on the most recent payment (the trigger
    // fires on UPDATE and recalculates amount_paid, balance_due, status, paid_at)
    if (payments && payments.length > 0) {
      await supabase
        .from('payments')
        .update({ status: 'completed' })
        .eq('document_id', documentId)
        .eq('status', 'completed')
        .limit(1)
    } else {
      // No payments exist — reset document to unpaid state
      await supabase
        .from('documents')
        .update({ amount_paid: 0, balance_due: doc.total, status: 'sent', paid_at: null })
        .eq('id', documentId)
    }

    // Re-fetch the document after trigger has run
    const { data: updated, error: updateError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Auto-complete customer actions triggered by this payment status
    await autoCompleteActions(documentId, updated.status).catch(() => {})

    return NextResponse.json({
      success: true,
      document: updated,
      payments: payments || [],
      totalPaid: updated.amount_paid,
      balanceDue: updated.balance_due,
      status: updated.status
    })
  } catch (error: any) {
    console.error('Error syncing payment status:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
