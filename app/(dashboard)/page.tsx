export const dynamic = 'force-dynamic'
export const revalidate = 0
import { supabase } from '../lib/supabase'
import CommandCenter from './CommandCenter'

export default async function DashboardPage() {
  // Get current month start for MTD calculations
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString()

  // Fetch all documents (quotes and invoices)
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  const quotes = documents?.filter(d => d.doc_type === 'quote') || []
  const invoices = documents?.filter(d => d.doc_type === 'invoice') || []

  // Fetch active submissions
  const { data: submissions } = await supabase
    .from('submissions')
    .select('*')
    .in('status', ['new', 'contacted', 'quoted'])
    .order('created_at', { ascending: false })

  // Fetch active tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .neq('status', 'COMPLETED')
    .order('created_at', { ascending: false })

  // Fetch pinned items
  const { data: pinnedItems } = await supabase
    .from('pinned_items')
    .select('*')

  // Calculate metrics matching legacy system

  // Monthly revenue from paid invoices this month
  const monthlyPaidInvoices = invoices.filter(inv =>
    inv.status === 'paid' &&
    inv.paid_at &&
    new Date(inv.paid_at) >= new Date(monthStart)
  )
  const monthlyRevenue = monthlyPaidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0)

  // Bonus-eligible categories (matching legacy: PPF, Full Wrap, Partial Wrap, Vinyl Lettering, Vinyl Graphics)
  const bonusCategories = ['PPF', 'FULL_WRAP', 'PARTIAL_WRAP', 'VINYL_LETTERING', 'VINYL_GRAPHICS']
  const ppfVinylRevenue = monthlyPaidInvoices
    .filter(inv => bonusCategories.includes(inv.category?.toUpperCase()))
    .reduce((sum, inv) => sum + (inv.total || 0), 0)

  // 2.5% bonus calculation
  const bonus25Pct = ppfVinylRevenue * 0.025

  // Pipeline value: active quotes + unpaid invoices (matching legacy logic)
  const activeQuotes = quotes.filter(q =>
    q.status !== 'archived' &&
    q.status !== 'declined' &&
    q.status !== 'expired'
  )
  const unpaidInvoices = invoices.filter(i =>
    i.status !== 'paid' &&
    i.status !== 'void'
  )
  const quotesTotalValue = activeQuotes.reduce((sum, q) => sum + (q.total || 0), 0)
  const invoicesUnpaidValue = unpaidInvoices.reduce((sum, i) => sum + (i.balance_due || i.total || 0), 0)
  const pipelineValue = quotesTotalValue + invoicesUnpaidValue

  // Category breakdown for current month
  const categoryTotals: Record<string, number> = {}
  monthlyPaidInvoices.forEach(inv => {
    const cat = inv.category || 'Other'
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (inv.total || 0)
  })
  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  const dashboardData = {
    quotes: quotes || [],
    invoices: invoices || [],
    submissions: submissions || [],
    tasks: tasks || [],
    pinnedItems: pinnedItems || [],
    metrics: {
      monthlyRevenue,
      ppfVinylRevenue,
      bonus25Pct,
      pipelineValue
    },
    categoryBreakdown
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <CommandCenter initialData={dashboardData} />
    </div>
  )
}
