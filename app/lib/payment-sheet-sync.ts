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

interface Fee {
  amount: number
  fee_type: string
  description: string
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
    fees?: Fee[] | string
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
          subtotal,
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

    // Parse fees from document
    let fees: Fee[] = []
    try {
      if (doc.fees) {
        fees = typeof doc.fees === 'string' ? JSON.parse(doc.fees) : doc.fees
      }
    } catch (error) {
      console.warn('Failed to parse fees:', error)
      fees = []
    }

    // Check if we have at least line items OR fees
    if ((!lineItems || lineItems.length === 0) && (!fees || fees.length === 0)) {
      return {
        success: false,
        rowsAdded: 0,
        error: 'No line items or fees found for this document'
      }
    }

    // Calculate payment date
    const paymentDate = new Date(payment.created_at)
    const dateStr = formatDate(paymentDate)
    const timestampStr = formatTimestamp(paymentDate)

    // Calculate discount multiplier (e.g., 5% discount = 0.95 multiplier)
    const discountPercent = doc.discount_percent || 0
    const discountMultiplier = 1 - (discountPercent / 100)

    const lineItemRows: PaymentRowData[] = []
    const txnNumbers: string[] = []

    // Calculate the total of all line items after discount
    const lineItemsTotal = (lineItems || []).reduce((sum, item) => {
      return sum + (item.line_total * discountMultiplier)
    }, 0)

    // Calculate the total of all fees (fees are not discounted)
    const feesTotal = fees.reduce((sum, fee) => sum + fee.amount, 0)

    // Combined total for proportional calculations
    const combinedTotal = lineItemsTotal + feesTotal

    // Calculate how much of each line item this payment covers
    // (proportional based on line item amounts AFTER discount)
    for (const lineItem of lineItems || []) {
      // Apply discount to this line item
      const discountedLineTotal = lineItem.line_total * discountMultiplier

      // Calculate proportion based on this line item's share of combined total
      // Then apply that proportion to the actual payment amount
      const lineItemProportion = discountedLineTotal / combinedTotal
      const lineItemPaymentAmount = payment.amount * lineItemProportion

      // Get sheet category from mapping
      const sheetCategory = getSheetCategory(lineItem.category)

      // Generate TXN number
      const txnNumber = await getNextTransactionNumber()
      txnNumbers.push(txnNumber)

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

    // Process fees (design fees, rush fees, etc.) as revenue rows
    for (const fee of fees) {
      // Calculate proportion based on this fee's share of combined total
      const feeProportion = fee.amount / combinedTotal
      const feePaymentAmount = payment.amount * feeProportion

      // Generate TXN number
      const txnNumber = await getNextTransactionNumber()
      txnNumbers.push(txnNumber)

      // Create row for fee - map to "Other Revenue"
      const row: PaymentRowData = {
        txnNumber,
        date: dateStr,
        business: 'FWG',
        direction: 'IN',
        eventType: 'Sale',
        amount: Math.round(feePaymentAmount * 100) / 100,
        account: 'Stripe',
        category: 'Other Revenue', // All fees mapped to Other Revenue
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
      }

      lineItemRows.push(row)
    }

    // Add Stripe processing fee as a separate expense row (if fee > 0)
    if (payment.processing_fee && payment.processing_fee > 0) {
      const feeTxnNumber = await getNextTransactionNumber()
      txnNumbers.push(feeTxnNumber)

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
