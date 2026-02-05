export const dynamic = 'force-dynamic'
export const revalidate = 0
import { supabase } from '../lib/supabase'
import { getCommandCenterMetrics, getPipelineMetrics } from '../lib/googleSheets'
import CommandCenter from './CommandCenter'

export default async function DashboardPage() {
  // Fetch UI data from Supabase
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
    .neq('auto_generated', true)
    .order('created_at', { ascending: false })

  const { data: pinnedItems } = await supabase
    .from('pinned_items')
    .select('*')

  const { data: calendarEvents } = await supabase
    .from('calendar_events')
    .select('document_id')
    .not('document_id', 'is', null)

  // Fetch LIVE metrics from Google Sheets
  let liveMetrics = {
    fwgMtdTotal: 0,
    fwgYtdTotal: 0,
    bonusEligibleMtd: 0,
    bonus25Pct: 0,
    categoryMtd: {} as Record<string, number>
  }
  try {
    liveMetrics = await getCommandCenterMetrics()
  } catch (error) {
    console.error('Error fetching Google Sheets metrics:', error)
  }

  // Calculate pipeline value from Supabase data (not Google Sheets)
  const activeQuoteStatuses = ['draft', 'sent', 'viewed', 'approved', 'revision_requested', 'option_selected']
  const quotePipelineValue = (quotes || [])
    .filter(q => activeQuoteStatuses.includes(q.status?.toLowerCase()))
    .reduce((sum, q) => sum + (q.total || 0), 0)

  const invoicePipelineValue = (invoices || [])
    .filter(i => i.status?.toLowerCase() !== 'paid' && i.status?.toLowerCase() !== 'void' && i.status?.toLowerCase() !== 'archived')
    .reduce((sum, i) => sum + (i.balance_due || i.total || 0), 0)

  const submissionPipelineValue = (submissions || [])
    .reduce((sum, s) => sum + (s.price_range_max || 0), 0)

  const pipelineValue = quotePipelineValue + invoicePipelineValue + submissionPipelineValue

  // Convert category breakdown to array format
  const categoryBreakdown = Object.entries(liveMetrics.categoryMtd || {})
    .map(([category, amount]) => ({ category, amount: amount as number }))
    .sort((a, b) => b.amount - a.amount)

  // Get invoice IDs that have calendar events scheduled
  const scheduledInvoiceIds = new Set((calendarEvents || []).map(e => e.document_id))

  const dashboardData = {
    quotes: quotes || [],
    invoices: (invoices || []).map(inv => ({ ...inv, hasScheduledEvent: scheduledInvoiceIds.has(inv.id) })),
    submissions: submissions || [],
    tasks: tasks || [],
    pinnedItems: pinnedItems || [],
    metrics: {
      monthlyRevenue: liveMetrics.fwgMtdTotal,
      ppfVinylRevenue: liveMetrics.bonusEligibleMtd,
      bonus25Pct: liveMetrics.bonus25Pct,
      yearlyRevenue: liveMetrics.fwgYtdTotal,
      pipelineValue: pipelineValue
    },
    categoryBreakdown
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <CommandCenter initialData={dashboardData} />
    </div>
  )
}
