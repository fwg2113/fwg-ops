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
    .not('bucket', 'in', '("ARCHIVE_WON","ARCHIVE_LOST")')
    .order('created_at', { ascending: false })

  const { data: invoices } = await supabase
    .from('documents')
    .select('*')
    .eq('doc_type', 'invoice')
    .neq('status', 'archived')
    .not('bucket', 'in', '("ARCHIVE_WON","ARCHIVE_LOST")')
    .order('created_at', { ascending: false })

  const { data: submissions } = await supabase
    .from('submissions')
    .select('*')
    .not('status', 'in', '("converted","lost","archived")')
    .order('created_at', { ascending: false })

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .neq('status', 'COMPLETED')
    .neq('auto_generated', true)
    .order('created_at', { ascending: false })

  // Fetch ALL customer actions (TODO + COMPLETED) for workflow timeline
  const { data: customerActions } = await supabase
    .from('customer_actions')
    .select('*, documents:document_id(id, customer_name, doc_number, doc_type, total, vehicle_description, project_description, category, status)')
    .order('sort_order', { ascending: true })

  // Fetch production task stats for in-production documents
  const inProductionIds = [
    ...((quotes || []).filter(q => q.in_production).map(q => q.id)),
    ...((invoices || []).filter(i => i.in_production).map(i => i.id))
  ]

  let productionStatus: Record<string, { total: number; completed: number }> = {}
  if (inProductionIds.length > 0) {
    const { data: prodTasks } = await supabase
      .from('tasks')
      .select('document_id, status')
      .eq('auto_generated', true)
      .or('archived.is.null,archived.eq.false')
      .in('document_id', inProductionIds)

    if (prodTasks) {
      for (const t of prodTasks) {
        if (!t.document_id) continue
        if (!productionStatus[t.document_id]) {
          productionStatus[t.document_id] = { total: 0, completed: 0 }
        }
        productionStatus[t.document_id].total++
        if (t.status === 'COMPLETED') {
          productionStatus[t.document_id].completed++
        }
      }
    }
  }

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
    customerActions: customerActions || [],
    productionStatus,
    pinnedItems: pinnedItems || [],
    metrics: {
      monthlyRevenue: liveMetrics.fwgMtdTotal,
      ppfVinylRevenue: liveMetrics.bonusEligibleMtd,
      bonus25Pct: liveMetrics.bonus25Pct,
      embroideryBonus10Pct: liveMetrics.embroideryBonus10Pct,
      yearlyRevenue: liveMetrics.fwgYtdTotal,
    },
    categoryBreakdown
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <CommandCenter initialData={dashboardData} />
    </div>
  )
}
