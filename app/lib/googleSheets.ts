import { google } from 'googleapis'

// Google Sheets IDs from legacy CONFIG
const SHEETS_CONFIG = {
  financialCoreSheetId: '1dK9v4XosHHHs6eJWHBhhBVtSQKS8_hcZa2uelp3ErBc',
  opsSheetId: '1Pyh1w6Gsx7pkZd9uRwB4YhGQfb0VWHzIE_qzcSO39lw'
}

// Initialize Google Sheets API client
function getGoogleSheetsClient() {
  const envVar = process.env.GOOGLE_SHEETS_CREDENTIALS
  console.log('Raw env var length:', envVar?.length)
  console.log('First 100 chars:', envVar?.substring(0, 100))

  const credentials = JSON.parse(envVar || '{}')
  console.log('Parsed credentials has client_email:', !!credentials.client_email)

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
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
    'Vinyl Graphics Revenue'
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
    }
  })

  // Calculate 2.5% bonus (legacy line 735)
  const bonus25Pct = bonusEligibleMtd * 0.025

  return {
    fwgMtdTotal,
    fwgYtdTotal,
    bonusEligibleMtd,
    bonus25Pct,
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
