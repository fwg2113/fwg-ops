import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { line_item_id, garment_source, received_quantities, receiving_notes, transfer_status } = body

  if (!line_item_id) {
    return NextResponse.json({ error: 'line_item_id required' }, { status: 400 })
  }

  // Build update object from only what was passed
  const updates: Record<string, any> = {}
  if (garment_source !== undefined) updates.garment_source = garment_source
  if (received_quantities !== undefined) updates.received_quantities = received_quantities
  if (receiving_notes !== undefined) updates.receiving_notes = receiving_notes
  if (transfer_status !== undefined) updates.transfer_status = transfer_status

  // Auto-compute garment_status from received_quantities
  if (received_quantities !== undefined) {
    const vals = Object.values(received_quantities) as number[]
    const totalReceived = vals.reduce((a, b) => a + b, 0)
    if (totalReceived === 0) {
      updates.garment_status = 'ordered'
    } else {
      // Fetch ordered quantities to compare
      const { data: li } = await supabase
        .from('line_items')
        .select('custom_fields')
        .eq('id', line_item_id)
        .single()

      const sizes: Record<string, number> = li?.custom_fields?.sizes || {}
      const totalOrdered = Object.values(sizes).reduce((a: number, b: any) => a + Number(b), 0)
      updates.garment_status = totalReceived >= totalOrdered ? 'received' : 'partially_received'
    }
  }

  // Save line item update
  const { data: li, error } = await supabase
    .from('line_items')
    .update(updates)
    .eq('id', line_item_id)
    .select('document_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recompute document production_status
  const { data: allLineItems } = await supabase
    .from('line_items')
    .select('garment_status, transfer_status, custom_fields')
    .eq('document_id', li.document_id)
    .eq('custom_fields->>apparel_mode', 'true')

  let docStatus = 'pending'

  if (allLineItems && allLineItems.length > 0) {
    const garmentStatuses = allLineItems.map(l => l.garment_status || 'pending_source')
    const transferStatuses = allLineItems.map(l => l.transfer_status || 'pending')

    const allGarmentsReceived = garmentStatuses.every(s => s === 'received')
    const allTransfersReady = transferStatuses.every(s => s === 'ready')
    const anyPartial = garmentStatuses.some(s => s === 'partially_received')
    const anyOrdered = garmentStatuses.some(s => s === 'ordered')

    if (allGarmentsReceived && allTransfersReady) {
      docStatus = 'ready_for_production'
    } else if (anyPartial) {
      docStatus = 'partially_received'
    } else if (anyOrdered) {
      docStatus = 'garments_ordered'
    } else {
      docStatus = 'pending'
    }
  }

  await supabase
    .from('documents')
    .update({ production_status: docStatus })
    .eq('id', li.document_id)

  return NextResponse.json({ success: true, production_status: docStatus })
}
