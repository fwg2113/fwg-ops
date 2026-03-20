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

  // Fetch categories for parent_category grouping and label display
  const { data: dbCategories } = await supabase
    .from('categories')
    .select('category_key, parent_category, label')
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

  // Fetch YTD from Google Sheets (historical data goes back further)
  let sheetsMetrics = {
    fwgMtdTotal: 0,
    fwgYtdTotal: 0,
    bonusEligibleMtd: 0,
    bonus25Pct: 0,
    embroideryBonus10Pct: 0,
    categoryMtd: {} as Record<string, number>
  }
  try {
    sheetsMetrics = await getCommandCenterMetrics()
  } catch (error) {
    console.error('Error fetching Google Sheets metrics:', error)
  }

  // Fetch MTD metrics from Supabase (payments + line items = source of truth)
  // This gives accurate revenue by category based on actual payments received
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data: mtdPayments } = await supabase
    .from('payments')
    .select('document_id, amount, processing_fee')
    .eq('status', 'completed')
    .gte('created_at', monthStart)

  // Build category label map from categories table
  const catLabelMap: Record<string, string> = {}
  for (const c of (dbCategories || [])) { catLabelMap[c.category_key] = c.label || c.category_key }

  // Bonus-eligible categories (automotive + signage parent categories, excluding window tint)
  const bonusEligibleKeys = (dbCategories || [])
    .filter(c => ['AUTOMOTIVE', 'SIGNAGE'].includes(c.parent_category) && c.category_key !== 'WINDOW_TINT')
    .map(c => c.category_key)

  let fwgMtdTotal = 0
  let bonusEligibleMtd = 0
  let embroideryMtd = 0
  const categoryMtd: Record<string, number> = {}

  // Fee type display labels
  const feeTypeLabels: Record<string, string> = {
    'DESIGN': 'Design Fee',
    'RUSH': 'Rush Fee',
    'DELIVERY': 'Delivery',
    'VECTORIZING': 'Design Fee',
    'DIGITIZING_INHOUSE': 'Design Fee',
  }

  if (mtdPayments && mtdPayments.length > 0) {
    // Group payments by document, summing net amounts
    const docPayments: Record<string, number> = {}
    for (const p of mtdPayments) {
      const net = (parseFloat(String(p.amount)) || 0) - (parseFloat(String(p.processing_fee)) || 0)
      docPayments[p.document_id] = (docPayments[p.document_id] || 0) + net
      fwgMtdTotal += net
    }

    // Get line items AND document fees for all paid documents
    const paidDocIds = Object.keys(docPayments)
    const { data: paidLineItems } = await supabase
      .from('line_items')
      .select('document_id, category, line_total')
      .in('document_id', paidDocIds)

    const { data: paidDocs } = await supabase
      .from('documents')
      .select('id, fees')
      .in('id', paidDocIds)

    // Parse document-level fees into a flat list
    type FeeEntry = { document_id: string; label: string; amount: number }
    const docFees: FeeEntry[] = []
    if (paidDocs) {
      for (const d of paidDocs) {
        if (!d.fees) continue
        const fees = typeof d.fees === 'string' ? JSON.parse(d.fees) : d.fees
        if (!Array.isArray(fees)) continue
        for (const f of fees) {
          const amt = parseFloat(String(f.amount)) || 0
          if (amt <= 0) continue
          docFees.push({
            document_id: d.id,
            label: feeTypeLabels[f.fee_type] || f.description || 'Other Fee',
            amount: amt
          })
        }
      }
    }

    // Calculate base total per document (line items + fees) for proportional allocation
    const docBaseTotals: Record<string, number> = {}
    for (const li of (paidLineItems || [])) {
      docBaseTotals[li.document_id] = (docBaseTotals[li.document_id] || 0) + (li.line_total || 0)
    }
    for (const f of docFees) {
      docBaseTotals[f.document_id] = (docBaseTotals[f.document_id] || 0) + f.amount
    }

    // Allocate each document's net payment proportionally by line item category
    for (const li of (paidLineItems || [])) {
      const baseTotal = docBaseTotals[li.document_id] || 0
      if (baseTotal <= 0) continue
      const proportion = (li.line_total || 0) / baseTotal
      const allocated = (docPayments[li.document_id] || 0) * proportion
      const label = catLabelMap[li.category] || li.category
      categoryMtd[label] = (categoryMtd[label] || 0) + allocated

      if (bonusEligibleKeys.includes(li.category)) {
        bonusEligibleMtd += allocated
      }
      if (li.category === 'EMBROIDERY') {
        embroideryMtd += allocated
      }
    }

    // Allocate fees proportionally too
    for (const f of docFees) {
      const baseTotal = docBaseTotals[f.document_id] || 0
      if (baseTotal <= 0) continue
      const proportion = f.amount / baseTotal
      const allocated = (docPayments[f.document_id] || 0) * proportion
      categoryMtd[f.label] = (categoryMtd[f.label] || 0) + allocated
    }
  }

  // Round category values
  for (const key of Object.keys(categoryMtd)) {
    categoryMtd[key] = Math.round(categoryMtd[key] * 100) / 100
  }

  const bonus25Pct = bonusEligibleMtd * 0.025
  const embroideryBonus10Pct = embroideryMtd * 0.10

  // Convert category breakdown to array format
  const categoryBreakdown = Object.entries(categoryMtd)
    .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount)

  // Fetch documents flagged as Expected Revenue (confirmed jobs waiting on payment)
  // Include docs where balance_due > 0 OR balance_due = 0 but status is not 'paid'
  // (quotes may have balance_due=0 because it's not set until payments are made)
  const { data: expectedRevenueDocs } = await supabase
    .from('documents')
    .select('id, doc_number, doc_type, customer_name, total, balance_due, amount_paid, status')
    .eq('expected_revenue', true)
    .neq('status', 'paid')
    .order('total', { ascending: false })

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
      monthlyRevenue: Math.round(fwgMtdTotal),
      commissionPool: Math.round(bonusEligibleMtd),
      bonus25Pct: Math.round(bonus25Pct),
      embroideryBonus10Pct: Math.round(embroideryBonus10Pct),
      yearlyRevenue: sheetsMetrics.fwgYtdTotal,
    },
    categoryBreakdown,
    expectedRevenue: (expectedRevenueDocs || []).map(d => {
      const total = parseFloat(String(d.total)) || 0
      const amountPaid = parseFloat(String(d.amount_paid)) || 0
      const balanceDue = parseFloat(String(d.balance_due)) || 0
      // Use balance_due if set, otherwise calculate from total - amount_paid
      const effectiveBalance = balanceDue > 0 ? balanceDue : Math.max(0, total - amountPaid)
      return {
        id: d.id,
        doc_number: d.doc_number,
        doc_type: d.doc_type,
        customer_name: d.customer_name,
        total,
        balance_due: effectiveBalance,
      }
    }).filter(d => d.balance_due > 0)
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <CommandCenter initialData={dashboardData} />
    </div>
  )
}
