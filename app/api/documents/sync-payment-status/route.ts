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
      .select('amount, created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true })

    if (paymentsError) {
      return NextResponse.json({ error: paymentsError.message }, { status: 500 })
    }

    // Calculate total amount paid
    const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)
    const balanceDue = Math.max(0, Number(doc.total) - totalPaid)

    // Determine status
    let status = 'draft'
    if (totalPaid === 0) {
      status = 'sent' // Or keep existing status if no payments
    } else if (balanceDue === 0) {
      status = 'paid'
    } else {
      status = 'partial'
    }

    // Get the first payment date for paid_at
    const paidAt = totalPaid > 0 && balanceDue === 0 && payments && payments.length > 0
      ? payments[payments.length - 1].created_at // Last payment that made it fully paid
      : null

    // Update the document
    const { data: updated, error: updateError } = await supabase
      .from('documents')
      .update({
        amount_paid: totalPaid.toFixed(2),
        balance_due: balanceDue.toFixed(2),
        status,
        paid_at: paidAt
      })
      .eq('id', documentId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Auto-complete customer actions triggered by this payment status
    await autoCompleteActions(documentId, status).catch(() => {})

    return NextResponse.json({
      success: true,
      document: updated,
      payments: payments || [],
      totalPaid,
      balanceDue,
      status
    })
  } catch (error: any) {
    console.error('Error syncing payment status:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
