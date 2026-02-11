/**
 * Payment to Google Sheets Sync
 *
 * Handles the conversion of payments from Supabase to Google Sheets TRANSACTIONS rows
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

interface LineItem {
  id: string
  category: string
  description: string
  line_total: number
  taxable?: boolean
}

interface Fee {
  amount: number
  fee_type: string
  description: string
}

/**
 * Sync a payment to Google Sheets TRANSACTIONS
 *
 * @param paymentId The UUID of the payment to sync
 * @returns Result with success status and details
 */
export async function syncPaymentToSheet(paymentId: string): Promise<{
  success: boolean
  rowsAdded: number
  error?: string
  txnNumbers?: string[]
}> {
  try {
    // Check if already synced
    const { data: paymentCheck } = await supabase
      .from('payments')
      .select('synced_to_sheets')
      .eq('id', paymentId)
      .single()

    if (paymentCheck?.synced_to_sheets) {
      return {
        success: true,
        rowsAdded: 0,
        error: 'Payment already synced to Google Sheets'
      }
    }

    // Fetch payment with related data
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(`
        id,
        document_id,
        amount,
        processing_fee,
        payment_method,
        processor,
        created_at,
        documents!inner(
          doc_number,
          customer_name,
          total,
          amount_paid,
          discount_percent,
          discount_amount,
          subtotal,
          tax_amount,
          fees
        )
      `)
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      return {
        success: false,
        rowsAdded: 0,
        error: `Failed to fetch payment: ${paymentError?.message || 'Payment not found'}`
      }
    }

    // Extract document data
    const doc = Array.isArray(payment.documents) ? payment.documents[0] : payment.documents
    if (!doc) {
      return { success: false, rowsAdded: 0, error: 'Document data not found for payment' }
    }

    // Fetch line items for this document
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('line_items')
      .select('id, category, description, line_total, taxable')
      .eq('document_id', payment.document_id)
      .order('sort_order')

    if (lineItemsError) {
      return { success: false, rowsAdded: 0, error: `Failed to fetch line items: ${lineItemsError.message}` }
    }

    // Parse fees from document
    let fees: Fee[] = []
    try {
      if (doc.fees) {
        fees = typeof doc.fees === 'string' ? JSON.parse(doc.fees) : doc.fees
      }
    } catch {
      fees = []
    }

    // Filter out $0 line items — no point adding a $0 row
    const validLineItems = (lineItems || []).filter(item => item.line_total > 0)

    if (validLineItems.length === 0 && fees.length === 0) {
      return { success: false, rowsAdded: 0, error: 'No line items or fees found for this document' }
    }

    // Payment date
    const paymentDate = new Date(payment.created_at)
    const dateStr = formatDate(paymentDate)
    const timestampStr = formatTimestamp(paymentDate)

    // Discount multiplier
    const discountPercent = doc.discount_percent || 0
    const discountMultiplier = 1 - (discountPercent / 100)

    // Calculate totals for proportional split
    const lineItemsTotal = validLineItems.reduce((sum, item) => sum + item.line_total, 0)
    const discountedLineItemsTotal = lineItemsTotal * discountMultiplier
    const feesTotal = fees.reduce((sum, fee) => sum + fee.amount, 0)

    // Use the actual tax_amount from the document (not a calculated guess)
    const actualTax = parseFloat(String(doc.tax_amount)) || 0

    // Grand total = discounted line items + fees + actual tax
    // This should match doc.total but we compute from components for accuracy
    const grandTotal = discountedLineItemsTotal + feesTotal + actualTax

    if (grandTotal <= 0) {
      return { success: false, rowsAdded: 0, error: 'Grand total is zero — nothing to sync' }
    }

    // Determine if this payment actually went through Stripe
    const isStripePayment = (payment as any).processor === 'stripe'
    const isCardPayment = payment.payment_method === 'card' || payment.payment_method === 'card_present'

    // Net payment = amount minus actual processing fee (only for real Stripe payments)
    const actualProcessingFee = isStripePayment && isCardPayment ? (payment.processing_fee || 0) : 0
    const netPaymentAmount = payment.amount - actualProcessingFee

    // Payment percentage = how much of the invoice this payment covers
    const paymentPercentage = Math.min(netPaymentAmount / grandTotal, 1)

    // Map payment method to account name for the sheet
    const accountName = isStripePayment ? 'Stripe'
      : payment.payment_method === 'cash' ? 'Cash'
      : payment.payment_method === 'check' ? 'Check'
      : payment.payment_method === 'card' || payment.payment_method === 'card_present' ? 'Credit Card'
      : payment.payment_method === 'bank_transfer' || payment.payment_method === 'us_bank_account' ? 'Bank Transfer'
      : 'Other'

    console.log('=== PAYMENT SYNC DEBUG ===')
    console.log('Payment amount:', payment.amount, '| Method:', payment.payment_method, '| Processor:', (payment as any).processor)
    console.log('Net payment (excl fee):', netPaymentAmount)
    console.log('Grand total:', grandTotal, '(line items:', discountedLineItemsTotal, '+ fees:', feesTotal, '+ tax:', actualTax, ')')
    console.log('Payment percentage:', (paymentPercentage * 100).toFixed(1) + '%')
    console.log('Account:', accountName)

    // Get ONE starting TXN number — then increment locally for all rows
    // This prevents the duplicate TXN bug from calling getNextTransactionNumber() multiple times
    const firstTxnStr = await getNextTransactionNumber()
    let currentTxnNum = parseInt(firstTxnStr.replace('TXN-', ''), 10)

    const allRows: PaymentRowData[] = []
    const txnNumbers: string[] = []

    // Helper to get next TXN number (local increment, no re-fetching)
    const nextTxn = () => {
      const txn = `TXN-${String(currentTxnNum).padStart(5, '0')}`
      txnNumbers.push(txn)
      currentTxnNum++
      return txn
    }

    // --- Line item rows ---
    for (const lineItem of validLineItems) {
      const discountedLineTotal = lineItem.line_total * discountMultiplier
      const lineItemPaymentAmount = Math.round(discountedLineTotal * paymentPercentage * 100) / 100

      if (lineItemPaymentAmount <= 0) continue

      allRows.push({
        txnNumber: nextTxn(),
        date: dateStr,
        business: 'FWG',
        direction: 'IN',
        eventType: 'Sale',
        amount: lineItemPaymentAmount,
        account: accountName,
        category: getSheetCategory(lineItem.category),
        serviceLine: '',
        customerName: doc.customer_name || 'Unknown',
        notes: '',
        invoiceNumber: doc.doc_number || '',
        columnM: '',
        columnN: '',
        columnO: '',
        lineItemDescription: lineItem.description || '',
        columnQ: '',
        timestamp: timestampStr
      })
    }

    // --- Fee rows ---
    for (const fee of fees) {
      const feePaymentAmount = Math.round(fee.amount * paymentPercentage * 100) / 100

      if (feePaymentAmount <= 0) continue

      allRows.push({
        txnNumber: nextTxn(),
        date: dateStr,
        business: 'FWG',
        direction: 'IN',
        eventType: 'Sale',
        amount: feePaymentAmount,
        account: accountName,
        category: 'Other Revenue',
        serviceLine: '',
        customerName: doc.customer_name || 'Unknown',
        notes: '',
        invoiceNumber: doc.doc_number || '',
        columnM: '',
        columnN: '',
        columnO: '',
        lineItemDescription: fee.description || `${fee.fee_type} Fee`,
        columnQ: '',
        timestamp: timestampStr
      })
    }

    // --- Sales tax row (only if the invoice actually has tax) ---
    if (actualTax > 0) {
      const taxPaymentAmount = Math.round(actualTax * paymentPercentage * 100) / 100

      if (taxPaymentAmount > 0) {
        allRows.push({
          txnNumber: nextTxn(),
          date: dateStr,
          business: 'FWG',
          direction: 'OUT',
          eventType: 'Expense',
          amount: taxPaymentAmount,
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
    }

    // --- Stripe processing fee row (only for actual Stripe payments) ---
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

    if (allRows.length === 0) {
      return { success: false, rowsAdded: 0, error: 'No rows to sync (all amounts were $0)' }
    }

    // Append all rows to Google Sheets
    const result = await appendPaymentRows(allRows)

    // Mark payment as synced to prevent duplicates
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
