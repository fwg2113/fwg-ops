import { supabase } from '../lib/supabase'
import CommandCenter from './CommandCenter'

export default async function DashboardPage() {
  // Get current month start
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Fetch all quotes
  const { data: quotes } = await supabase
    .from('documents')
    .select('*')
    .eq('doc_type', 'quote')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  // Fetch all invoices
  const { data: invoices } = await supabase
    .from('documents')
    .select('*')
    .eq('doc_type', 'invoice')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

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

  // Calculate metrics
  // Monthly revenue from paid invoices this month
  const { data: monthlyPaidInvoices } = await supabase
    .from('documents')
    .select('total, category')
    .eq('doc_type', 'invoice')
    .eq('status', 'paid')
    .gte('paid_at', monthStart)

  const monthlyRevenue = monthlyPaidInvoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0

  // PPF & Vinyl revenue (categories: PPF, FULL_WRAP, PARTIAL_WRAP, COLOR_CHANGE, COMMERCIAL_WRAP)
  const ppfVinylCategories = ['PPF', 'FULL_WRAP', 'PARTIAL_WRAP', 'COLOR_CHANGE', 'COMMERCIAL_WRAP']
  const ppfVinylRevenue = monthlyPaidInvoices
    ?.filter(inv => ppfVinylCategories.includes(inv.category))
    .reduce((sum, inv) => sum + (inv.total || 0), 0) || 0

  // Pipeline value from sent/viewed quotes
  const pipelineValue = quotes
    ?.filter(q => q.status === 'sent' || q.status === 'viewed')
    .reduce((sum, q) => sum + (q.total || 0), 0) || 0

  // Category breakdown
  const categoryTotals: Record<string, number> = {}
  monthlyPaidInvoices?.forEach(inv => {
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
