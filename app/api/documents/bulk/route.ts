import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { action, ids, params } = await request.json()

    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing action or ids' },
        { status: 400 }
      )
    }

    if (ids.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Maximum 50 documents per bulk action' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'delete':
        return handleBulkDelete(ids)
      case 'archive':
        return handleBulkArchive(ids, params)
      case 'snooze':
        return handleBulkSnooze(ids, params)
      case 'expected_revenue':
        return handleBulkExpectedRevenue(ids, params)
      case 'change_bucket':
        return handleBulkChangeBucket(ids, params)
      case 'followup':
        return handleBulkFollowUp(ids)
      case 'set_temperature':
        return handleBulkSetTemperature(ids, params)
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (err: any) {
    console.error('Bulk action error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// ── Delete ──────────────────────────────────────────────────────────────
async function handleBulkDelete(ids: string[]) {
  // Fetch documents and check for payments
  const { data: docs, error: fetchError } = await supabase
    .from('documents')
    .select('id, doc_number, doc_type')
    .in('id', ids)

  if (fetchError) {
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
  }

  const { data: payments } = await supabase
    .from('payments')
    .select('id, document_id')
    .in('document_id', ids)

  const docIdsWithPayments = new Set((payments || []).map(p => p.document_id))
  const skipped: { id: string; doc_number: number; reason: string }[] = []
  const toDelete: string[] = []

  for (const doc of docs || []) {
    if (docIdsWithPayments.has(doc.id)) {
      skipped.push({ id: doc.id, doc_number: doc.doc_number, reason: 'Has payments — delete payments first' })
    } else {
      toDelete.push(doc.id)
    }
  }

  if (toDelete.length > 0) {
    // Cascade delete related records
    await supabase.from('line_items').delete().in('document_id', toDelete)
    await supabase.from('tasks').delete().in('document_id', toDelete)
    await supabase.from('customer_actions').delete().in('document_id', toDelete)

    // Clear submission references
    for (const id of toDelete) {
      await supabase
        .from('submissions')
        .update({ converted_to_quote_id: null })
        .eq('converted_to_quote_id', id)
    }

    // Delete the documents
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .in('id', toDelete)

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    success: true,
    updated: toDelete.length,
    skipped
  })
}

// ── Archive ─────────────────────────────────────────────────────────────
async function handleBulkArchive(ids: string[], params: { archiveType: 'won' | 'lost' }) {
  if (!params?.archiveType) {
    return NextResponse.json({ success: false, error: 'Missing archiveType (won or lost)' }, { status: 400 })
  }

  const bucket = params.archiveType === 'won' ? 'ARCHIVE_WON' : 'ARCHIVE_LOST'

  // Fetch current status/bucket to save pre-archive values
  const { data: docs, error: fetchError } = await supabase
    .from('documents')
    .select('id, status, bucket')
    .in('id', ids)

  if (fetchError) {
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
  }

  // Update each doc with its own pre-archive values
  const results = await Promise.allSettled(
    (docs || []).map(doc =>
      supabase
        .from('documents')
        .update({
          status: 'archived',
          bucket,
          pre_archive_status: doc.status,
          pre_archive_bucket: doc.bucket
        })
        .eq('id', doc.id)
    )
  )

  const failed = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({
    success: true,
    updated: (docs || []).length - failed,
    skipped: []
  })
}

// ── Snooze ──────────────────────────────────────────────────────────────
async function handleBulkSnooze(ids: string[], params: { snoozed: boolean }) {
  if (typeof params?.snoozed !== 'boolean') {
    return NextResponse.json({ success: false, error: 'Missing snoozed parameter' }, { status: 400 })
  }

  const { error } = await supabase
    .from('documents')
    .update({
      snoozed: params.snoozed,
      snoozed_at: params.snoozed ? new Date().toISOString() : null
    })
    .in('id', ids)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, updated: ids.length, skipped: [] })
}

// ── Expected Revenue ────────────────────────────────────────────────────
async function handleBulkExpectedRevenue(ids: string[], params: { expected_revenue: boolean }) {
  if (typeof params?.expected_revenue !== 'boolean') {
    return NextResponse.json({ success: false, error: 'Missing expected_revenue parameter' }, { status: 400 })
  }

  const { error } = await supabase
    .from('documents')
    .update({ expected_revenue: params.expected_revenue })
    .in('id', ids)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, updated: ids.length, skipped: [] })
}

// ── Change Bucket ───────────────────────────────────────────────────────
async function handleBulkChangeBucket(ids: string[], params: { bucket: string }) {
  const validBuckets = ['READY_FOR_ACTION', 'ACTION_NEEDED', 'WAITING_ON_CUSTOMER', 'IN_PRODUCTION', 'COLD']
  if (!params?.bucket || !validBuckets.includes(params.bucket)) {
    return NextResponse.json(
      { success: false, error: `Invalid bucket. Must be one of: ${validBuckets.join(', ')}` },
      { status: 400 }
    )
  }

  const update: Record<string, any> = { bucket: params.bucket }

  // If moving to production, also set the flag
  if (params.bucket === 'IN_PRODUCTION') {
    update.in_production = true
  }

  const { error } = await supabase
    .from('documents')
    .update(update)
    .in('id', ids)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, updated: ids.length, skipped: [] })
}

// ── Set Temperature (warm/cold/clear) ───────────────────────────────────
async function handleBulkSetTemperature(ids: string[], params: { temperature: 'warm' | 'cold' | null }) {
  const value = params?.temperature
  if (value !== 'warm' && value !== 'cold' && value !== null) {
    return NextResponse.json(
      { success: false, error: 'temperature must be "warm", "cold", or null' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('documents')
    .update({ temperature: value })
    .in('id', ids)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, updated: ids.length, skipped: [] })
}

// ── Follow Up ───────────────────────────────────────────────────────────
async function handleBulkFollowUp(ids: string[]) {
  // Fetch documents with contact info
  const { data: docs, error: fetchError } = await supabase
    .from('documents')
    .select('id, doc_number, doc_type, customer_name, customer_email, customer_phone, status, followup_count')
    .in('id', ids)

  if (fetchError) {
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
  }

  const skipped: { id: string; doc_number: number; reason: string }[] = []
  const toFollowUp: typeof docs = []

  for (const doc of docs || []) {
    if (doc.status === 'draft') {
      skipped.push({ id: doc.id, doc_number: doc.doc_number, reason: 'Still in draft — send it first' })
    } else if (!doc.customer_email && !doc.customer_phone) {
      skipped.push({ id: doc.id, doc_number: doc.doc_number, reason: 'No email or phone on file' })
    } else {
      toFollowUp.push(doc)
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fwg-ops.vercel.app'

  // Send follow-ups
  for (const doc of toFollowUp) {
    const firstName = doc.customer_name?.split(' ')[0] || 'there'
    const docLabel = doc.doc_type === 'quote' ? 'quote' : 'invoice'
    const viewUrl = `${appUrl}/view/${doc.id}`
    const followUpMessage = `Hi ${firstName}, just checking in on the ${docLabel} we sent over. Let us know if you have any questions!\n\nView your ${docLabel}: ${viewUrl}`

    // Send email if available
    if (doc.customer_email) {
      try {
        await fetch(`${appUrl}/api/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: doc.id,
            to: doc.customer_email,
            subject: `Following up on your ${docLabel} #${doc.doc_number}`,
            message: `Hi ${firstName}, just checking in on the ${docLabel} we sent over. Let us know if you have any questions!`
          })
        })
      } catch (e) {
        console.error(`Failed to send follow-up email for doc ${doc.doc_number}:`, e)
      }
    }

    // Send SMS if available
    if (doc.customer_phone) {
      try {
        await fetch(`${appUrl}/api/sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: doc.customer_phone,
            message: followUpMessage
          })
        })
      } catch (e) {
        console.error(`Failed to send follow-up SMS for doc ${doc.doc_number}:`, e)
      }
    }

    // Update follow-up tracking
    await supabase
      .from('documents')
      .update({
        followup_count: (doc.followup_count || 0) + 1,
        last_followup_at: new Date().toISOString()
      })
      .eq('id', doc.id)
  }

  return NextResponse.json({
    success: true,
    updated: toFollowUp.length,
    skipped
  })
}
