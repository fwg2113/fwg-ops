/**
 * Payment to Google Sheets Sync
 *
 * One payment = one row in TRANSACTIONS (plus optional tax and Stripe fee rows)
 */

import { supabase } from '@/app/lib/supabase'
import {
  appendPaymentRows,
  getNextTransactionNumber,
  formatDate,
  formatTimestamp,
  type PaymentRowData
} from './googleSheets'
import { getSheetCategory } from './category-mapping'

/**
 * Sync a payment to Google Sheets TRANSACTIONS
 *
 * Creates:
 * - 1 IN/Sale row for the payment amount
 * - 1 OUT/Expense row for sales tax (only if invoice has tax, proportional to payment)
 * - 1 OUT/Expense row for Stripe processing fee (only for actual Stripe payments)
 *
 * @param paymentId The UUID of the payment to sync
 * @param force If true, skip the already-synced check and add rows again
 */
export async function syncPaymentToSheet(paymentId: string, force = false): Promise<{
  success: boolean
  rowsAdded: number
  error?: string
  alreadySynced?: boolean
  txnNumbers?: string[]
}> {
  try {
    // Check if already synced (skip if force=true)
    if (!force) {
      const { data: paymentCheck } = await supabase
        .from('payments')
        .select('synced_to_sheets')
        .eq('id', paymentId)
        .single()

      if (paymentCheck?.synced_to_sheets) {
        return { success: true, rowsAdded: 0, alreadySynced: true }
      }
    }

    // Fetch payment with document data
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(`
        id,
        document_id,
        amount,
        processing_fee,
        payment_method,
        processor,
        notes,
        created_at,
        documents!inner(
          doc_number,
          customer_name,
          category,
          total,
          tax_amount,
          project_description,
          vehicle_description
        )
      `)
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      return { success: false, rowsAdded: 0, error: `Failed to fetch payment: ${paymentError?.message || 'Payment not found'}` }
    }

    const doc = Array.isArray(payment.documents) ? payment.documents[0] : payment.documents
    if (!doc) {
      return { success: false, rowsAdded: 0, error: 'Document data not found for payment' }
    }

    // Payment basics
    const paymentDate = new Date(payment.created_at)
    const dateStr = formatDate(paymentDate)
    const timestampStr = formatTimestamp(paymentDate)

    const isStripePayment = (payment as any).processor === 'stripe'
    const isCardPayment = payment.payment_method === 'card' || payment.payment_method === 'card_present'

    // The actual revenue amount (for Stripe card payments, exclude the processing fee)
    const actualProcessingFee = isStripePayment && isCardPayment ? (payment.processing_fee || 0) : 0
    const revenueAmount = payment.amount - actualProcessingFee

    // Account name based on payment method
    const accountName = isStripePayment ? 'Stripe'
      : payment.payment_method === 'cash' ? 'Cash'
      : payment.payment_method === 'check' ? 'Check'
      : payment.payment_method === 'card' || payment.payment_method === 'card_present' ? 'Credit Card'
      : payment.payment_method === 'bank_transfer' || payment.payment_method === 'us_bank_account' ? 'Bank Transfer'
      : 'Other'

    // Revenue category from the document's category
    const category = getSheetCategory(doc.category)

    // Description for the row
    const description = doc.project_description || doc.vehicle_description || ''

    // Calculate proportional tax if the invoice has tax
    const invoiceTotal = parseFloat(String(doc.total)) || 0
    const invoiceTax = parseFloat(String(doc.tax_amount)) || 0
    let taxAmount = 0
    if (invoiceTax > 0 && invoiceTotal > 0) {
      // Proportional: if paying 50% of invoice, tax is 50% of total tax
      const paymentProportion = Math.min(revenueAmount / invoiceTotal, 1)
      taxAmount = Math.round(invoiceTax * paymentProportion * 100) / 100
    }

    console.log('=== PAYMENT SYNC ===')
    console.log(`Invoice #${doc.doc_number} | ${doc.customer_name} | ${accountName}`)
    console.log(`Payment: $${payment.amount} | Revenue: $${revenueAmount} | Tax: $${taxAmount} | Fee: $${actualProcessingFee}`)

    // Get starting TXN number, then increment locally
    const firstTxnStr = await getNextTransactionNumber()
    let currentTxnNum = parseInt(firstTxnStr.replace('TXN-', ''), 10)
    const allRows: PaymentRowData[] = []
    const txnNumbers: string[] = []

    const nextTxn = () => {
      const txn = `TXN-${String(currentTxnNum).padStart(5, '0')}`
      txnNumbers.push(txn)
      currentTxnNum++
      return txn
    }

    // --- Row 1: The payment (IN / Sale) ---
    allRows.push({
      txnNumber: nextTxn(),
      date: dateStr,
      business: 'FWG',
      direction: 'IN',
      eventType: 'Sale',
      amount: Math.round(revenueAmount * 100) / 100,
      account: accountName,
      category,
      serviceLine: '',
      customerName: doc.customer_name || 'Unknown',
      notes: payment.notes || '',
      invoiceNumber: doc.doc_number || '',
      columnM: '',
      columnN: '',
      columnO: '',
      lineItemDescription: description,
      columnQ: '',
      timestamp: timestampStr
    })

    // --- Row 2 (optional): Sales tax (OUT / Expense) ---
    if (taxAmount > 0) {
      allRows.push({
        txnNumber: nextTxn(),
        date: dateStr,
        business: 'FWG',
        direction: 'OUT',
        eventType: 'Expense',
        amount: taxAmount,
        account: accountName,
        category: 'Sales Tax',
        serviceLine: '',
        customerName: doc.customer_name || 'Unknown',
        notes: 'Sales tax collected',
        invoiceNumber: doc.doc_number || '',
        columnM: '',
        columnN: '',
        columnO: '',
        lineItemDescription: 'Sales tax',
        columnQ: '',
        timestamp: timestampStr
      })
    }

    // --- Row 3 (optional): Stripe processing fee (OUT / Expense) ---
    if (isStripePayment && actualProcessingFee > 0) {
      allRows.push({
        txnNumber: nextTxn(),
        date: dateStr,
        business: 'FWG',
        direction: 'OUT',
        eventType: 'Expense',
        amount: Math.round(actualProcessingFee * 100) / 100,
        account: 'Stripe',
        category: 'Merchant Fees',
        serviceLine: '',
        customerName: doc.customer_name || 'Unknown',
        notes: 'Stripe processing fee',
        invoiceNumber: doc.doc_number || '',
        columnM: '',
        columnN: '',
        columnO: '',
        lineItemDescription: `${isCardPayment ? 'Card' : 'ACH'} processing fee`,
        columnQ: '',
        timestamp: timestampStr
      })
    }

    // Append to Google Sheets
    const result = await appendPaymentRows(allRows)

    // Mark as synced to prevent duplicates
    if (result.success) {
      await supabase
        .from('payments')
        .update({ synced_to_sheets: true })
        .eq('id', paymentId)
    }

    return { ...result, txnNumbers }
  } catch (error: any) {
    console.error('Error syncing payment to sheet:', error)
    return { success: false, rowsAdded: 0, error: error.message || 'Unknown error occurred' }
  }
}
