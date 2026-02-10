import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateCustomerActions } from '@/app/lib/customer/actionGenerator'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Backfill customer actions for existing documents that don't have them yet.
 *
 * POST /api/customer-actions/backfill
 * Body: { dryRun?: boolean }
 *
 * - Finds all non-archived documents without customer_actions
 * - Generates actions based on each document's category and current status
 * - Past steps auto-complete based on current document status
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const dryRun = body.dryRun === true

    // Get all non-archived documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, doc_number, doc_type, status, category, customer_name')
      .neq('status', 'archived')
      .order('created_at', { ascending: false })

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 })
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ message: 'No documents found', results: [] })
    }

    // Get document IDs that already have customer actions
    const { data: existingActions } = await supabase
      .from('customer_actions')
      .select('document_id')
      .not('document_id', 'is', null)

    const docsWithActions = new Set(
      (existingActions || []).map(a => a.document_id)
    )

    // Filter to documents without actions
    const docsToBackfill = documents.filter(d => !docsWithActions.has(d.id))

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        totalDocuments: documents.length,
        alreadyHaveActions: documents.length - docsToBackfill.length,
        toBackfill: docsToBackfill.length,
        documents: docsToBackfill.map(d => ({
          id: d.id,
          doc_number: d.doc_number,
          doc_type: d.doc_type,
          status: d.status,
          category: d.category || 'OTHER',
          customer_name: d.customer_name
        }))
      })
    }

    // Generate actions for each document
    const results = []
    for (const doc of docsToBackfill) {
      const category = doc.category || 'OTHER'
      const result = await generateCustomerActions(doc.id, category, doc.status)
      results.push({
        doc_id: doc.id,
        doc_number: doc.doc_number,
        customer_name: doc.customer_name,
        category,
        currentStatus: doc.status,
        ...result
      })
    }

    const successCount = results.filter(r => r.success).length
    const totalActions = results.reduce((sum, r) => sum + r.actionsCreated, 0)

    return NextResponse.json({
      message: `Backfilled ${successCount}/${docsToBackfill.length} documents with ${totalActions} total actions`,
      totalDocuments: documents.length,
      alreadyHaveActions: documents.length - docsToBackfill.length,
      backfilled: successCount,
      totalActionsCreated: totalActions,
      results
    })
  } catch (error: any) {
    console.error('Backfill error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
