import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// POST /api/customer-actions/propagate
// Propagates workflow step changes from templates to all live document actions.
// Called when saving customer workflow template edits in settings.
//
// Body: { templateKey: string }
//
// Logic:
// 1. Fetch current template steps
// 2. Fetch all customer_actions for live (non-archived) documents with this template_key
// 3. For new steps: insert TODO actions for documents that don't have them
// 4. For removed steps: delete TODO actions (preserve COMPLETED ones)
// 5. For modified steps: update title, description, priority, sort_order, auto_complete_on_status

export async function POST(request: Request) {
  try {
    const { templateKey } = await request.json()

    if (!templateKey) {
      return NextResponse.json({ error: 'templateKey required' }, { status: 400 })
    }

    // 1. Get current template steps
    const { data: steps, error: stepsErr } = await supabase
      .from('customer_workflow_steps')
      .select('*')
      .eq('template_key', templateKey)
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (stepsErr) throw stepsErr

    const stepKeys = new Set((steps || []).map(s => s.step_key))

    // 2. Get all live documents using this template
    // Find documents whose customer_actions reference this template_key
    const { data: existingActions, error: actionsErr } = await supabase
      .from('customer_actions')
      .select('id, document_id, submission_id, step_key, status, title, description, priority, sort_order, auto_complete_on_status')
      .eq('template_key', templateKey)

    if (actionsErr) throw actionsErr

    // Group actions by document_id
    const actionsByDoc = new Map<string, typeof existingActions>()
    for (const a of existingActions || []) {
      const key = a.document_id || a.submission_id || ''
      if (!key) continue
      if (!actionsByDoc.has(key)) actionsByDoc.set(key, [])
      actionsByDoc.get(key)!.push(a)
    }

    // Filter to only non-archived documents
    const docIds = [...actionsByDoc.keys()]
    if (docIds.length === 0) {
      return NextResponse.json({ success: true, updated: 0, added: 0, removed: 0, message: 'No live documents to update' })
    }

    // Check which documents are archived
    const { data: archivedDocs } = await supabase
      .from('documents')
      .select('id')
      .in('id', docIds)
      .or('bucket.eq.ARCHIVE_WON,status.eq.archived')

    const archivedIds = new Set((archivedDocs || []).map(d => d.id))

    let added = 0
    let updated = 0
    let removed = 0

    for (const [entityId, actions] of actionsByDoc) {
      // Skip archived documents
      if (archivedIds.has(entityId)) continue

      const existingStepKeys = new Set(actions.map(a => a.step_key))

      // 3. Add new steps that don't exist yet
      for (const step of steps || []) {
        if (!existingStepKeys.has(step.step_key)) {
          const isDocAction = actions[0]?.document_id
          const { error: insertErr } = await supabase
            .from('customer_actions')
            .insert({
              document_id: isDocAction ? entityId : null,
              submission_id: isDocAction ? null : entityId,
              template_key: templateKey,
              step_key: step.step_key,
              title: step.label,
              description: step.description,
              status: 'TODO',
              priority: step.default_priority,
              sort_order: step.sort_order,
              auto_complete_on_status: step.auto_complete_on_status,
              auto_generated: true
            })
          if (!insertErr) added++
        }
      }

      // 4. Remove actions for deleted steps (only TODO, preserve COMPLETED)
      for (const action of actions) {
        if (!stepKeys.has(action.step_key)) {
          if (action.status === 'TODO') {
            const { error: delErr } = await supabase
              .from('customer_actions')
              .delete()
              .eq('id', action.id)
            if (!delErr) removed++
          }
        }
      }

      // 5. Update existing actions to match template changes
      for (const step of steps || []) {
        const action = actions.find(a => a.step_key === step.step_key)
        if (!action) continue

        const needsUpdate =
          action.title !== step.label ||
          action.description !== step.description ||
          action.priority !== step.default_priority ||
          action.sort_order !== step.sort_order ||
          action.auto_complete_on_status !== step.auto_complete_on_status

        if (needsUpdate) {
          const { error: updErr } = await supabase
            .from('customer_actions')
            .update({
              title: step.label,
              description: step.description,
              priority: step.default_priority,
              sort_order: step.sort_order,
              auto_complete_on_status: step.auto_complete_on_status
            })
            .eq('id', action.id)
          if (!updErr) updated++
        }
      }
    }

    return NextResponse.json({
      success: true,
      added,
      updated,
      removed,
      totalDocuments: actionsByDoc.size - archivedIds.size
    })
  } catch (err: any) {
    console.error('Propagate error:', err)
    return NextResponse.json({ error: err.message || 'Failed to propagate' }, { status: 500 })
  }
}
