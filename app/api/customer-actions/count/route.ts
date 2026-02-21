import { supabase } from '@/app/lib/supabase'
import { NextResponse } from 'next/server'

// Replicates CommandCenter's getCardState logic to count "action_needed" items
// Excludes snoozed items from the count
export async function GET() {
  try {
    // Fetch all the same data the dashboard uses
    const [quotesRes, invoicesRes, submissionsRes, tasksRes, actionsRes] = await Promise.all([
      supabase
        .from('documents')
        .select('id, status, bucket, in_production, snoozed')
        .eq('doc_type', 'quote')
        .neq('status', 'archived')
        .not('bucket', 'in', '("ARCHIVE_WON","ARCHIVE_LOST")'),
      supabase
        .from('documents')
        .select('id, status, bucket, in_production, snoozed')
        .eq('doc_type', 'invoice')
        .neq('status', 'archived')
        .not('bucket', 'in', '("ARCHIVE_WON","ARCHIVE_LOST")'),
      supabase
        .from('submissions')
        .select('id, snoozed')
        .not('status', 'in', '("converted","lost","archived")'),
      supabase
        .from('tasks')
        .select('id')
        .neq('status', 'COMPLETED')
        .neq('auto_generated', true),
      supabase
        .from('customer_actions')
        .select('document_id, submission_id, status')
        .eq('status', 'TODO'),
    ])

    const quotes = quotesRes.data || []
    const invoices = invoicesRes.data || []
    const submissions = submissionsRes.data || []
    const manualTasks = tasksRes.data || []
    const todoActions = actionsRes.data || []

    // Build sets of doc/sub IDs that have TODO actions
    const docsWithTodo = new Set<string>()
    const subsWithTodo = new Set<string>()
    for (const a of todoActions) {
      if (a.document_id) docsWithTodo.add(a.document_id)
      if (a.submission_id) subsWithTodo.add(a.submission_id)
    }

    // Get production status for in-production docs
    const inProductionIds = [
      ...quotes.filter(q => q.in_production).map(q => q.id),
      ...invoices.filter(i => i.in_production).map(i => i.id),
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

    // Replicate getCardState logic
    const getCardState = (doc: { id: string; status: string; in_production: boolean }) => {
      const prodStat = productionStatus[doc.id]
      if (doc.in_production && prodStat && prodStat.completed < prodStat.total) return 'in_production'
      if (doc.in_production && prodStat && prodStat.total > 0 && prodStat.completed >= prodStat.total) return 'production_complete'
      if (docsWithTodo.has(doc.id)) return 'action_needed'
      if (doc.status === 'sent' || doc.status === 'viewed') return 'waiting'
      return 'idle'
    }

    let actionNeededCount = 0

    // Submissions with TODO actions = action_needed (exclude snoozed)
    for (const sub of submissions) {
      if (sub.snoozed) continue
      if (subsWithTodo.has(sub.id)) actionNeededCount++
    }

    // Quotes (not COLD, not snoozed) with action_needed state
    for (const doc of quotes.filter(q => q.bucket !== 'COLD' && !q.snoozed)) {
      if (getCardState(doc) === 'action_needed') actionNeededCount++
    }

    // Invoices (not COLD, not snoozed) with action_needed state
    for (const doc of invoices.filter(i => i.bucket !== 'COLD' && !i.snoozed)) {
      if (getCardState(doc) === 'action_needed') actionNeededCount++
    }

    // All manual tasks are always action_needed
    actionNeededCount += manualTasks.length

    return NextResponse.json({ count: actionNeededCount })
  } catch (err: any) {
    return NextResponse.json({ count: 0, error: err.message })
  }
}
