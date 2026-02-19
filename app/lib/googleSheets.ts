import { google } from 'googleapis'

// Google Sheets IDs from legacy CONFIG
const SHEETS_CONFIG = {
  financialCoreSheetId: '1dK9v4XosHHHs6eJWHBhhBVtSQKS8_hcZa2uelp3ErBc',
  opsSheetId: '1Pyh1w6Gsx7pkZd9uRwB4YhGQfb0VWHzIE_qzcSO39lw'
}

// Initialize Google Sheets API client
function getGoogleSheetsClient(readonly = true) {
  const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}')

  const scopes = readonly
    ? ['https://www.googleapis.com/auth/spreadsheets.readonly']
    : ['https://www.googleapis.com/auth/spreadsheets']

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes
  })

  return google.sheets({ version: 'v4', auth })
}

// Helper: Parse currency string to number
function parseCurrency(value: string | number): number {
  if (typeof value === 'number') return value
  if (!value) return 0
  const cleaned = String(value).replace(/[\$,]/g, '')
  return parseFloat(cleaned) || 0
}

// Helper: Get current month start
function getCurrentMonthStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

// Helper: Get current year
function getCurrentYear(): number {
  return new Date().getFullYear()
}

// Read TRANSACTIONS sheet from Financial Core
async function getTransactionsData() {
  const sheets = getGoogleSheetsClient()

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_CONFIG.financialCoreSheetId,
    range: 'TRANSACTIONS!A2:R' // From row 2 to end, columns A-R
  })

  const rows = response.data.values || []

  // Column indices (0-indexed)
  const COL_DATE = 1        // Column B
  const COL_BUSINESS = 2    // Column C
  const COL_DIRECTION = 3   // Column D
  const COL_AMOUNT = 5      // Column F
  const COL_CATEGORY = 7    // Column H

  return rows.map(row => ({
    date: row[COL_DATE] ? new Date(row[COL_DATE]) : null,
    business: row[COL_BUSINESS],
    direction: row[COL_DIRECTION],
    amount: parseCurrency(row[COL_AMOUNT]),
    category: row[COL_CATEGORY]
  }))
}

// Read Documents sheet from Ops
async function getDocumentsData() {
  const sheets = getGoogleSheetsClient()

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_CONFIG.opsSheetId,
    range: 'Documents!A2:Z' // From row 2 to end
  })

  const rows = response.data.values || []
  const headers = ['id', 'doc_type', 'doc_number', 'status', 'total', 'balance_due', 'bucket'] // Adjust based on actual columns

  return rows.map(row => {
    const doc: any = {}
    headers.forEach((header, i) => {
      doc[header] = row[i]
    })
    doc.total = parseCurrency(doc.total)
    doc.balance_due = parseCurrency(doc.balance_due)
    return doc
  })
}

// Read Submissions sheet from Ops
async function getSubmissionsData() {
  const sheets = getGoogleSheetsClient()

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_CONFIG.opsSheetId,
    range: 'Submissions!A2:Z'
  })

  const rows = response.data.values || []
  const headers = ['id', 'status'] // Adjust based on actual columns

  return rows.map(row => {
    const sub: any = {}
    headers.forEach((header, i) => {
      sub[header] = row[i]
    })
    return sub
  })
}

// Calculate Command Center Metrics (matching legacy getCommandCenterMetrics function)
export async function getCommandCenterMetrics() {
  const transactions = await getTransactionsData()
  const currentYear = getCurrentYear()
  const monthStart = getCurrentMonthStart()

  // Bonus-eligible categories (from legacy code lines 571-577)
  const bonusCategories = [
    'PPF Revenue',
    'Full Wrap Revenue',
    'Partial Wrap Revenue',
    'Vinyl Lettering Revenue',
    'Vinyl Graphics Revenue',
    'Signage Revenue',
    'Stickers Revenue',
    'Labels Revenue'
  ]

  // Category display name mapping
  const categoryLabels: Record<string, string> = {
    'PPF Revenue': 'PPF',
    'Full Wrap Revenue': 'Full Wrap',
    'Partial Wrap Revenue': 'Partial Wrap',
    'Vinyl Lettering Revenue': 'Vinyl Lettering',
    'Vinyl Graphics Revenue': 'Vinyl Graphics',
    'Apparel Revenue': 'Apparel',
    'Embroidery Revenue': 'Embroidery',
    'Signage Revenue': 'Signage',
    'Stickers Revenue': 'Stickers',
    'Labels Revenue': 'Labels',
    'Design Fee Revenue': 'Design Fee',
    'DTF Transfer Revenue': 'DTF Transfer',
    'Window Graphics Revenue': 'Window Graphics',
    'Other Revenue': 'Other'
  }

  // Filter: Business='FWG', Direction='IN', Current Year
  const fwgRevenueTransactions = transactions.filter(t =>
    t.business === 'FWG' &&
    t.direction === 'IN' &&
    t.date &&
    t.date.getFullYear() === currentYear
  )

  // Calculate MTD and YTD totals
  let fwgMtdTotal = 0
  let fwgYtdTotal = 0
  let bonusEligibleMtd = 0
  let embroideryMtd = 0
  const categoryMtd: Record<string, number> = {}

  fwgRevenueTransactions.forEach(t => {
    const isCurrentMonth = t.date && t.date >= monthStart

    // YTD accumulation
    fwgYtdTotal += t.amount

    // MTD accumulation
    if (isCurrentMonth) {
      fwgMtdTotal += t.amount

      // Category breakdown
      const category = t.category || 'Other Revenue'
      const displayLabel = categoryLabels[category] || category
      categoryMtd[displayLabel] = (categoryMtd[displayLabel] || 0) + t.amount

      // Bonus-eligible revenue
      if (bonusCategories.includes(category)) {
        bonusEligibleMtd += t.amount
      }

      // Embroidery revenue tracking
      if (category === 'Embroidery Revenue') {
        embroideryMtd += t.amount
      }
    }
  })

  // Calculate 2.5% bonus (legacy line 735)
  const bonus25Pct = bonusEligibleMtd * 0.025

  // Calculate 10% embroidery bonus
  const embroideryBonus10Pct = embroideryMtd * 0.10

  return {
    fwgMtdTotal,
    fwgYtdTotal,
    bonusEligibleMtd,
    bonus25Pct,
    embroideryBonus10Pct,
    categoryMtd
  }
}

// Infer bucket status from document (matching legacy lines 468-474)
function inferBucket(doc: any): string {
  if (doc.bucket) return doc.bucket
  if (doc.status === 'Paid') return 'ARCHIVE_WON'
  if (doc.status === 'Void' || doc.status === 'Declined' || doc.status === 'Expired') return 'ARCHIVE_LOST'
  if (doc.status === 'Sent' || doc.status === 'Viewed') return 'WAITING_ON_CUSTOMER'
  return 'READY_FOR_ACTION'
}

// Calculate Pipeline Value (matching legacy getDashboardSummary)
export async function getPipelineMetrics() {
  const documents = await getDocumentsData()
  const submissions = await getSubmissionsData()

  // Split documents into quotes and invoices
  const quotes = documents.filter(d => d.doc_type === 'quote')
  const invoices = documents.filter(d => d.doc_type === 'invoice')

  // Calculate quote pipeline (active quotes only)
  const activeQuoteBuckets = ['READY_FOR_ACTION', 'WAITING_ON_CUSTOMER', 'COLD']
  const quotesTotalValue = quotes
    .filter(q => {
      const bucket = inferBucket(q)
      return activeQuoteBuckets.includes(bucket) && q.status !== 'Archived'
    })
    .reduce((sum, q) => sum + q.total, 0)

  // Calculate invoice pipeline (unpaid only)
  const invoicesUnpaidValue = invoices
    .filter(i => i.status !== 'Paid' && i.status !== 'Void')
    .reduce((sum, i) => sum + (i.balance_due || i.total), 0)

  // Total pipeline = quotes + unpaid invoices
  const pipelineValue = quotesTotalValue + invoicesUnpaidValue

  // Action items
  const newSubmissions = submissions.filter(s => s.status === 'New').length
  const approvedQuotes = quotes.filter(q => q.status === 'Approved').length
  const viewedQuotes = quotes.filter(q => q.status === 'Viewed').length
  const unpaidInvoices = invoices.filter(i =>
    i.status === 'Sent' || i.status === 'Viewed' || i.status === 'Partial'
  ).length

  return {
    pipelineValue,
    quotes: {
      totalValue: quotesTotalValue,
      count: quotes.filter(q => activeQuoteBuckets.includes(inferBucket(q))).length
    },
    invoices: {
      unpaidValue: invoicesUnpaidValue,
      count: unpaidInvoices
    },
    actionItems: {
      newSubmissions,
      approvedQuotes,
      viewedQuotes,
      unpaidInvoices
    }
  }
}

// ============================================================================
// PAYMENT TRACKING - Write Functions
// ============================================================================

/**
 * Get the next available TXN- number by reading the last row
 */
async function getNextTransactionNumber(): Promise<string> {
  const sheets = getGoogleSheetsClient(true) // Read-only is fine for this

  try {
    // Get column A (TransactionID) to find the last TXN number
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEETS_CONFIG.financialCoreSheetId,
      range: 'TRANSACTIONS!A:A'
    })

    const rows = response.data.values || []

    // Start from the bottom and find the last TXN-XXXXX format
    let lastTxnNumber = 0

    for (let i = rows.length - 1; i >= 0; i--) {
      const value = rows[i][0]
      if (value && typeof value === 'string' && value.startsWith('TXN-')) {
        const numberPart = value.replace('TXN-', '')
        const num = parseInt(numberPart, 10)
        if (!isNaN(num)) {
          lastTxnNumber = num
          break
        }
      }
    }

    // Generate next number with padding
    const nextNumber = lastTxnNumber + 1
    return `TXN-${String(nextNumber).padStart(5, '0')}`
  } catch (error) {
    console.error('Error getting next transaction number:', error)
    // Fallback to timestamp-based ID if there's an error
    return `TXN-${Date.now()}`
  }
}

/**
 * Format a timestamp in the Google Sheets format
 */
function formatTimestamp(date: Date): string {
  // Format: MM/DD/YYYY HH:MM:SS
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`
}

/**
 * Format a date in MM/DD/YYYY format
 */
function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()

  return `${month}/${day}/${year}`
}

export interface PaymentRowData {
  txnNumber: string          // Column A: TXN-XXXXX
  date: string               // Column B: MM/DD/YYYY
  business: string           // Column C: Always "FWG"
  direction: string          // Column D: Always "IN"
  eventType: string          // Column E: Always "Sale"
  amount: number             // Column F: Line item amount
  account: string            // Column G: Always "Stripe"
  category: string           // Column H: Revenue category
  serviceLine: string        // Column I: Empty for now
  customerName: string       // Column J: Customer name
  notes: string              // Column K: Empty for now
  invoiceNumber: string      // Column L: Invoice/document number
  columnM: string            // Column M: Empty
  columnN: string            // Column N: Empty
  columnO: string            // Column O: Empty
  lineItemDescription: string // Column P: Line item description
  columnQ: string            // Column Q: Empty
  timestamp: string          // Column R: Timestamp of row creation
}

/**
 * Append payment rows to the TRANSACTIONS sheet
 * @param rows Array of payment row data to append
 * @returns Success status and any errors
 */
export async function appendPaymentRows(rows: PaymentRowData[]): Promise<{
  success: boolean
  rowsAdded: number
  error?: string
}> {
  if (rows.length === 0) {
    return { success: true, rowsAdded: 0 }
  }

  const sheets = getGoogleSheetsClient(false) // Write access

  try {
    // Convert row data to array format matching columns A-R
    const values = rows.map(row => [
      row.txnNumber,           // A: TransactionID
      row.date,                // B: Date
      row.business,            // C: Business
      row.direction,           // D: Direction
      row.eventType,           // E: EventType
      row.amount,              // F: Amount
      row.account,             // G: Account
      row.category,            // H: Category
      row.serviceLine,         // I: ServiceLine
      row.customerName,        // J: Customer name
      row.notes,               // K: Notes
      row.invoiceNumber,       // L: Invoice number
      row.columnM,             // M: Empty
      row.columnN,             // N: Empty
      row.columnO,             // O: Empty
      row.lineItemDescription, // P: Line item description
      row.columnQ,             // Q: Empty
      row.timestamp            // R: Timestamp
    ])

    // Append to the sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEETS_CONFIG.financialCoreSheetId,
      range: 'TRANSACTIONS!A:R',
      valueInputOption: 'USER_ENTERED', // Allows Google Sheets to parse numbers/dates
      requestBody: {
        values
      }
    })

    console.log(`✓ Added ${rows.length} payment row(s) to Google Sheets`)

    return {
      success: true,
      rowsAdded: rows.length
    }
  } catch (error: any) {
    console.error('Error appending payment rows to Google Sheets:', error)
    return {
      success: false,
      rowsAdded: 0,
      error: error.message || 'Unknown error'
    }
  }
}

export { getNextTransactionNumber, formatTimestamp, formatDate }
