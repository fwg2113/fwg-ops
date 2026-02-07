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
}

interface PaymentWithDetails {
  id: string
  document_id: string
  amount: number
  processing_fee: number
  payment_method: string
  created_at: string
  document: {
    doc_number: string
    customer_name: string
    total: number
    amount_paid: number
    discount_percent: number
    discount_amount: number
    subtotal: number
  }
  line_items: LineItem[]
}

/**
 * Sync a payment to Google Sheets TRANSACTIONS
 *
 * This function:
 * 1. Fetches payment and document details from Supabase
 * 2. Calculates proportional split across line items
 * 3. Maps categories to sheet categories
 * 4. Creates rows for each line item + Stripe fee
 * 5. Appends rows to Google Sheets
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
    // Fetch payment with related data
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(`
        id,
        document_id,
        amount,
        processing_fee,
        payment_method,
        created_at,
        documents!inner(
          doc_number,
          customer_name,
          total,
          amount_paid,
          discount_percent,
          discount_amount,
          subtotal
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

    // Extract document data (Supabase returns documents as array with !inner)
    const doc = Array.isArray(payment.documents) ? payment.documents[0] : payment.documents
    if (!doc) {
      return {
        success: false,
        rowsAdded: 0,
        error: 'Document data not found for payment'
      }
    }

    // Fetch line items for this document
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('line_items')
      .select('id, category, description, line_total')
      .eq('document_id', payment.document_id)
      .order('sort_order')

    if (lineItemsError) {
      return {
        success: false,
        rowsAdded: 0,
        error: `Failed to fetch line items: ${lineItemsError.message}`
      }
    }

    if (!lineItems || lineItems.length === 0) {
      return {
        success: false,
        rowsAdded: 0,
        error: 'No line items found for this document'
      }
    }

    // Calculate payment date
    const paymentDate = new Date(payment.created_at)
    const dateStr = formatDate(paymentDate)
    const timestampStr = formatTimestamp(paymentDate)

    // Calculate discount multiplier (e.g., 5% discount = 0.95 multiplier)
    const discountPercent = doc.discount_percent || 0
    const discountMultiplier = 1 - (discountPercent / 100)

    // Calculate proportional split
    const documentTotal = doc.total
    const lineItemRows: PaymentRowData[] = []
    const txnNumbers: string[] = []

    // Get the starting TXN number (only call API once)
    const baseTxnNumber = await getNextTransactionNumber()
    const baseTxnNum = parseInt(baseTxnNumber.replace('TXN-', ''), 10)
    let currentTxnNum = baseTxnNum
    // Calculate base payment amount (exclude Stripe fee for splitting)
    const basePaymentAmount = payment.amount - (payment.processing_fee || 0)

    // ADD THIS:
    console.log('DEBUG:', {
    paymentAmount: payment.amount,
    processingFee: payment.processing_fee,
    basePaymentAmount,
    documentTotal,
    lineItemCount: lineItems.length
  })

    // Calculate the total of all line items after discount
    const discountedSubtotal = lineItems.reduce((sum, item) => {
      return sum + (item.line_total * discountMultiplier)
    }, 0)

    // Calculate how much of each line item this payment covers
    // (proportional based on line item amounts AFTER discount)
    for (const lineItem of lineItems) {
      // Apply discount to this line item
      const discountedLineTotal = lineItem.line_total * discountMultiplier

      // Calculate proportion based on discounted amount
      const lineItemProportion = discountedLineTotal / documentTotal
      const lineItemPaymentAmount = basePaymentAmount * lineItemProportion

      // Get sheet category from mapping
      const sheetCategory = getSheetCategory(lineItem.category)

      // Generate TXN number (increment locally)
      const txnNumber = `TXN-${String(currentTxnNum).padStart(5, '0')}`
      txnNumbers.push(txnNumber)
      currentTxnNum++

      // Create row
      const row: PaymentRowData = {
        txnNumber,
        date: dateStr,
        business: 'FWG',
        direction: 'IN',
        eventType: 'Sale',
        amount: Math.round(lineItemPaymentAmount * 100) / 100, // Round to 2 decimals
        account: 'Stripe',
        category: sheetCategory,
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
      }

      lineItemRows.push(row)
    }

    // Add Stripe processing fee as a separate expense row (if fee > 0)
    if (payment.processing_fee && payment.processing_fee > 0) {
      const feeTxnNumber = `TXN-${String(currentTxnNum).padStart(5, '0')}`
      txnNumbers.push(feeTxnNumber)
      currentTxnNum++

      const feeRow: PaymentRowData = {
        txnNumber: feeTxnNumber,
        date: dateStr,
        business: 'FWG',
        direction: 'OUT',
        eventType: 'Expense',
        amount: Math.round(payment.processing_fee * 100) / 100,
        account: 'Stripe',
        category: 'Payment Processing Fees',
        serviceLine: '',
        customerName: doc.customer_name || 'Unknown',
        notes: 'Stripe processing fee',
        invoiceNumber: doc.doc_number || '',
        columnM: '',
        columnN: '',
        columnO: '',
        lineItemDescription: `${payment.payment_method === 'us_bank_account' ? 'ACH' : 'Card'} processing fee`,
        columnQ: '',
        timestamp: timestampStr
      }

      lineItemRows.push(feeRow)
    }

    // Append all rows to Google Sheets
    const result = await appendPaymentRows(lineItemRows)

    return {
      ...result,
      txnNumbers
    }
  } catch (error: any) {
    console.error('Error syncing payment to sheet:', error)
    return {
      success: false,
      rowsAdded: 0,
      error: error.message || 'Unknown error occurred'
    }
  }
}

/**
 * Check if a payment has already been synced to Google Sheets
 * (This is a best-effort check - looks for TXN numbers in notes or a sync log table)
 *
 * For now, we'll add a simple flag to the payments table in a future migration
 */
export async function isPaymentSynced(paymentId: string): Promise<boolean> {
  // TODO: Add a `synced_to_sheets` boolean column to payments table
  // For now, always return false (allow re-sync)
  return false
}
