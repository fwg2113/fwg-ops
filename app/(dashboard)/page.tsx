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

  // Fetch categories for parent_category grouping
  const { data: dbCategories } = await supabase
    .from('categories')
    .select('category_key, parent_category')
    .eq('active', true)
  const catParentMap: Record<string, string> = {}
  for (const c of (dbCategories || [])) { catParentMap[c.category_key] = c.parent_category }

  // Fetch production pipeline data — include all paid OR in_production documents
  // (matches what the /production page shows)
  const inProductionIds = [
    ...((quotes || []).filter(q => q.in_production || q.status === 'paid').map(q => q.id)),
    ...((invoices || []).filter(i => i.in_production || i.status === 'paid').map(i => i.id))
  ]

  // Fetch pipeline configs and line items for production status computation
  const { data: pipelineDbConfigs } = await supabase
    .from('production_pipeline_configs')
    .select('*')
    .order('category_key')
    .order('sort_order')

  let productionStatus: Record<string, { total: number; completed: number }> = {}
  let nextProductionTasks: Record<string, { id: string; title: string; status: string; sort_order: number; track?: string }> = {}

  if (inProductionIds.length > 0) {
    const { data: prodLineItems } = await supabase
      .from('line_items')
      .select('id, document_id, category, line_type, production_checklist')
      .in('document_id', inProductionIds)

    if (prodLineItems && pipelineDbConfigs) {
      const { getTasksWithDb } = await import('../lib/production/checklist-config')
      const dbRows = pipelineDbConfigs as any[]

      for (const docId of inProductionIds) {
        const docItems = prodLineItems.filter(li => li.document_id === docId)
        let totalTasks = 0
        let completedTasks = 0
        let nextTask: typeof nextProductionTasks[string] | null = null

        for (const li of docItems) {
          const tasks = getTasksWithDb(li.category, dbRows, li.line_type)
          const checklist = (li.production_checklist || {}) as Record<string, any>

          // Also count ad-hoc custom tasks
          const customKeys = Object.keys(checklist).filter(k => k.startsWith('custom_'))
          const allTaskKeys = [...tasks.map(t => t.key), ...customKeys]

          totalTasks += allTaskKeys.length
          for (const key of allTaskKeys) {
            if (checklist[key]?.done) {
              completedTasks++
            } else if (!nextTask) {
              // First incomplete task across all line items = the "next" task
              const taskDef = tasks.find(t => t.key === key)
              const label = taskDef?.label || checklist[key]?.label || key.replace(/_/g, ' ')
              const track = checklist[key]?.track || (tasks.find(t => t.key === key) ? undefined : undefined)
              // Determine track from pipeline config
              let taskTrack = ''
              for (const cfg of dbRows) {
                if (cfg.category_key === li.category && cfg.task_key === key) { taskTrack = cfg.track; break }
                if (li.line_type && cfg.category_key === li.line_type && cfg.task_key === key) { taskTrack = cfg.track; break }
              }
              nextTask = { id: li.id, title: label.replace(/\\n/g, ' ').replace(/\n/g, ' '), status: 'TODO', sort_order: 0, track: taskTrack || checklist[key]?.track }
            }
          }
        }

        // If no pipeline tasks found, check for apparel line items and use apparel-style status
        if (totalTasks === 0) {
          const apparelCats = ['APPAREL', 'DTF_TRANSFER', 'DTF', 'EMBROIDERY', 'SCREEN_PRINT']
          const apparelItems = docItems.filter(li => apparelCats.includes(li.category))
          if (apparelItems.length > 0) {
            // Find the document to check its apparel pipeline flags
            const doc = [...(quotes || []), ...(invoices || [])].find(d => d.id === docId)
            if (doc) {
              // Build a simple progress from document-level apparel flags
              const apparelSteps = [
                { key: 'in_production', label: 'In Production', done: !!doc.in_production },
                { key: 'ready_for_qc', label: 'Ready for QC', done: !!doc.ready_for_qc },
                { key: 'qc_passed', label: 'QC Passed', done: !!doc.qc_passed },
                { key: 'packaged', label: 'Packaged', done: !!doc.packaged },
                { key: 'shipped', label: 'Shipped/Picked Up', done: !!doc.shipped || !!doc.ready_for_customer },
              ]
              totalTasks = apparelSteps.length
              completedTasks = apparelSteps.filter(s => s.done).length
              const nextStep = apparelSteps.find(s => !s.done)
              if (nextStep) {
                nextTask = { id: docId, title: nextStep.label, status: 'TODO', sort_order: 0 }
              }
            }
          }
        }

        if (totalTasks > 0) {
          productionStatus[docId] = { total: totalTasks, completed: completedTasks }
        }
        if (nextTask) {
          nextProductionTasks[docId] = nextTask
        }
      }
    }
  }

  // Build doc → parent_categories + specific categories mapping for production sub-tabs
  const productionDocCategories: Record<string, string[]> = {}
  if (inProductionIds.length > 0) {
    const { data: allProdLineItems } = await supabase
      .from('line_items')
      .select('document_id, category')
      .in('document_id', inProductionIds)
    if (allProdLineItems) {
      for (const li of allProdLineItems) {
        if (!productionDocCategories[li.document_id]) productionDocCategories[li.document_id] = []
        const parent = catParentMap[li.category]
        if (parent && !productionDocCategories[li.document_id].includes(parent)) {
          productionDocCategories[li.document_id].push(parent)
        }
        // Also store specific category for DTF/Embroidery distinction
        if (!productionDocCategories[li.document_id].includes(li.category)) {
          productionDocCategories[li.document_id].push(li.category)
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
    embroideryBonus10Pct: 0,
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
    nextProductionTasks,
    productionDocCategories,
    pinnedItems: pinnedItems || [],
    metrics: {
      monthlyRevenue: liveMetrics.fwgMtdTotal,
      commissionPool: liveMetrics.bonusEligibleMtd,
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
