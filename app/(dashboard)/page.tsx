export const dynamic = 'force-dynamic'
export const revalidate = 0
import { supabase } from '../lib/supabase'
import { getCommandCenterMetrics, getPipelineMetrics } from '../lib/googleSheets'
import CommandCenter from './CommandCenter'

export default async function DashboardPage() {
  // Fetch UI data from Supabase (quotes, invoices, submissions for display)
  const { data: quotes } = await supabase
    .from('documents')
    .select('*')
    .eq('doc_type', 'quote')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  const { data: invoices } = await supabase
    .from('documents')
    .select('*')
    .eq('doc_type', 'invoice')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  const { data: submissions } = await supabase
    .from('submissions')
    .select('*')
    .in('status', ['new', 'contacted', 'quoted'])
    .order('created_at', { ascending: false })

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .neq('status', 'COMPLETED')
    .order('created_at', { ascending: false })

  const { data: pinnedItems } = await supabase
    .from('pinned_items')
    .select('*')

  // Fetch LIVE metrics from Google Sheets (matching legacy AppScript exactly)
  let liveMetrics
  let pipelineMetrics

  try {
    liveMetrics = await getCommandCenterMetrics()
    pipelineMetrics = await getPipelineMetrics()
  } catch (error) {
    console.error('Error fetching Google Sheets metrics:', error)
    // Fallback to zero values if Sheets API fails
    liveMetrics = {
      fwgMtdTotal: 0,
      fwgYtdTotal: 0,
      bonusEligibleMtd: 0,
      bonus25Pct: 0,
      categoryMtd: {}
    }
    pipelineMetrics = {
      pipelineValue: 0,
      quotes: { totalValue: 0, count: 0 },
      invoices: { unpaidValue: 0, count: 0 },
      actionItems: { newSubmissions: 0, approvedQuotes: 0, viewedQuotes: 0, unpaidInvoices: 0 }
    }
  }

  // Convert category breakdown to array format
  const categoryBreakdown = Object.entries(liveMetrics.categoryMtd)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  const dashboardData = {
    quotes: quotes || [],
    invoices: invoices || [],
    submissions: submissions || [],
    tasks: tasks || [],
    pinnedItems: pinnedItems || [],
    metrics: {
      monthlyRevenue: liveMetrics.fwgMtdTotal,        // From Google Sheets TRANSACTIONS
      ppfVinylRevenue: liveMetrics.bonusEligibleMtd,  // From Google Sheets (bonus categories)
      bonus25Pct: liveMetrics.bonus25Pct,             // 2.5% of bonus-eligible revenue
      pipelineValue: pipelineMetrics.pipelineValue     // From Google Sheets Documents
    },
    categoryBreakdown
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <CommandCenter initialData={dashboardData} />
    </div>
  )
}
