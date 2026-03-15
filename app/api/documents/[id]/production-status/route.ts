import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const allowed = [
    'in_production', 'design_approved', 'sent_to_zayn', 'digitized', 'production_sort_order',
    // New pipeline fields
    'ready_for_qc', 'qc_passed', 'packaged', 'shipped',
    'tracking_number', 'shipping_label_url', 'easypost_shipment_id',
    'pickup_location', 'customer_notified_at', 'notification_method',
    // Legacy (still accepted for backward compat)
    'folded_counted_sorted', 'ready_for_customer',
  ]
  const updates: Record<string, any> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }
  const { error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch document info for side effects
  const { data: doc } = await supabase
    .from('documents')
    .select('customer_name, doc_number, fulfillment_type, status')
    .eq('id', id)
    .single()

  // --- Ready for QC: create QC action card ---
  if ('ready_for_qc' in updates) {
    if (updates.ready_for_qc === true) {
      const { data: existing } = await supabase
        .from('customer_actions')
        .select('id')
        .eq('document_id', id)
        .eq('step_key', 'QC_CHECK')
        .eq('status', 'TODO')
        .maybeSingle()

      if (!existing) {
        await supabase.from('customer_actions').insert({
          document_id: id,
          template_key: 'APPAREL_CUSTOMER',
          step_key: 'QC_CHECK',
          title: `QC Check needed — ${doc?.customer_name || 'Unknown'} #${doc?.doc_number || '?'}`,
          description: `Order ${doc?.doc_number || '?'} is ready for quality control inspection.`,
          status: 'TODO',
          priority: 'HIGH',
          sort_order: 100,
          auto_generated: true,
          assigned_to: 'diogo_or_mason',
        })
      }
    } else {
      // Undo: delete QC action if still TODO
      await supabase
        .from('customer_actions')
        .delete()
        .eq('document_id', id)
        .eq('step_key', 'QC_CHECK')
        .eq('status', 'TODO')
    }
  }

  // --- QC Passed: complete the QC action card ---
  if ('qc_passed' in updates) {
    if (updates.qc_passed === true) {
      await supabase
        .from('customer_actions')
        .update({ status: 'COMPLETED' })
        .eq('document_id', id)
        .eq('step_key', 'QC_CHECK')
        .eq('status', 'TODO')
    } else {
      // Undo: reopen QC action
      await supabase
        .from('customer_actions')
        .update({ status: 'TODO' })
        .eq('document_id', id)
        .eq('step_key', 'QC_CHECK')
        .eq('status', 'COMPLETED')
    }
  }

  // --- Shipped: update document status ---
  if ('shipped' in updates && updates.shipped === true) {
    await supabase
      .from('documents')
      .update({ status: 'shipped' })
      .eq('id', id)
  }

  // --- Packaged + pickup fulfillment: update status to ready_for_pickup ---
  if ('packaged' in updates && updates.packaged === true) {
    const ft = doc?.fulfillment_type
    if (ft === 'on_site_pickup' || ft === 'pickup_and_delivery' || !ft) {
      await supabase
        .from('documents')
        .update({ status: 'ready_for_pickup' })
        .eq('id', id)
    }
  }

  // --- Legacy: ready_for_customer side effects (kept for backward compat) ---
  if ('ready_for_customer' in updates) {
    if (updates.ready_for_customer === true) {
      await supabase
        .from('documents')
        .update({ status: 'ready_for_pickup' })
        .eq('id', id)
    } else {
      await supabase
        .from('documents')
        .update({ status: 'in_production' })
        .eq('id', id)
        .eq('status', 'ready_for_pickup')
    }
  }

  return NextResponse.json({ success: true })
}
