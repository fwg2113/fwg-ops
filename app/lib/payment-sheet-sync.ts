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
    tax_amount: number
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
      .select('id, category, description, line_total, taxable')
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

    // Get the starting transaction number for this batch
    const firstTxnStr = await getNextTransactionNumber()
    // Extract the numeric part from "TXN-00123" format
    let currentTxnNum = parseInt(firstTxnStr.replace('TXN-', ''), 10)

    // Calculate tax from line items (6% of TAXABLE line items after discount)
    // IMPORTANT: Tax only applies to line items marked as taxable, NOT to fees
    const lineItemsTotal = (lineItems || []).reduce((sum, item) => sum + item.line_total, 0)
    const taxableLineItemsTotal = (lineItems || []).filter(item => item.taxable).reduce((sum, item) => sum + item.line_total, 0)
    const discountedLineItemsTotal = lineItemsTotal * discountMultiplier
    const discountedTaxableTotal = taxableLineItemsTotal * discountMultiplier
    const taxRate = 0.06 // 6% sales tax
    const calculatedTax = discountedTaxableTotal * taxRate

    // Calculate fees total for debug output
    const feesTotal = fees.reduce((sum, fee) => sum + fee.amount, 0)

    // Calculate the grand total including tax (doc.total is pre-tax subtotal)
    const grandTotal = doc.total + calculatedTax

    // Calculate the net payment amount (excluding card processing fee surcharge)
    // payment.amount includes the card fee the customer paid, but that fee isn't invoice revenue
    const isCard = payment.payment_method === 'card' || payment.payment_method === 'card_present'
    const netPaymentAmount = isCard
      ? Math.round(((payment.amount - 0.30) / 1.029) * 100) / 100
      : payment.amount

    // Calculate what percentage of the total invoice this payment represents
    // This handles both full payments (100%) and partial payments (e.g., 50% deposit)
    const paymentPercentage = netPaymentAmount / grandTotal

    console.log('=== PAYMENT SYNC DEBUG ===')
    console.log('Payment amount:', payment.amount)
    console.log('Document total (pre-tax):', doc.total)
    console.log('Line items total:', lineItemsTotal)
    console.log('Fees total:', feesTotal)
    console.log('Discounted line items total:', discountedLineItemsTotal)
    console.log('Calculated tax (6% of line items ONLY):', calculatedTax)
    console.log('Grand total (line items + fees + tax):', grandTotal)
    console.log('Net payment amount:', netPaymentAmount)
    console.log('Payment percentage:', paymentPercentage)
    console.log('Discount percent:', discountPercent)
    console.log('Discount multiplier:', discountMultiplier)

    // Process each line item - apply discount first, then payment percentage
    for (const lineItem of lineItems || []) {
      // Apply discount to get the actual line item amount
      const discountedLineTotal = lineItem.line_total * discountMultiplier

      // Apply payment percentage (e.g., 50% for a deposit)
      const lineItemPaymentAmount = discountedLineTotal * paymentPercentage

      console.log(`Line item: ${lineItem.description}`)
      console.log(`  Original: $${lineItem.line_total}`)
      console.log(`  After discount: $${discountedLineTotal}`)
      console.log(`  Payment amount: $${lineItemPaymentAmount}`)

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

    // Process fees (design fees, rush fees, etc.) as revenue rows
    // Fees are NOT discounted, but ARE subject to payment percentage
    for (const fee of fees) {
      // Apply payment percentage to fee amount
      const feePaymentAmount = fee.amount * paymentPercentage

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

    // Add sales tax as an OUT expense row (if tax > 0)
    // Use calculated tax since doc.tax_amount is not populated
    if (calculatedTax > 0) {
      const taxPaymentAmount = calculatedTax * paymentPercentage

      const taxTxnNumber = await getNextTransactionNumber()
      txnNumbers.push(taxTxnNumber)

      const taxRow: PaymentRowData = {
        txnNumber: taxTxnNumber,
        date: dateStr,
        business: 'FWG',
        direction: 'OUT',
        eventType: 'Expense',
        amount: Math.round(taxPaymentAmount * 100) / 100,
        account: 'Stripe',
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
      }

      lineItemRows.push(taxRow)
    }

    // Add Stripe processing fee as a separate expense row
    // Always calculate fee - stored processing_fee is unreliable (known bug where it equals payment amount)
    const isCardPayment = payment.payment_method === 'card' || payment.payment_method === 'card_present'
    const stripeFee = isCardPayment
      ? Math.round(((netPaymentAmount * 0.029) + 0.30) * 100) / 100
      : 0 // Bank/ACH transfers have no processing fee

    if (stripeFee > 0) {
      const feeTxnNumber = await getNextTransactionNumber()
      txnNumbers.push(feeTxnNumber)
      currentTxnNum++

      const feeRow: PaymentRowData = {
        txnNumber: feeTxnNumber,
        date: dateStr,
        business: 'FWG',
        direction: 'OUT',
        eventType: 'Expense',
        amount: Math.round(stripeFee * 100) / 100,
        account: 'Stripe',
        category: 'Merchant Fees',
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
