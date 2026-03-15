import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

/**
 * GET /api/purchase-orders/active-count
 *
 * Returns count for sidebar badge:
 * - Line items that need to be ordered (PO Queue items)
 * - PLUS POs with tracking status updates (has_update flag)
 */
export async function GET() {
  try {
    // Count 1: Line items needing ordering
    const { data: poItems } = await supabase
      .from('purchase_order_items')
      .select('line_item_id')
    const alreadyOrdered = new Set((poItems || []).map(p => p.line_item_id))

    const { data: docs } = await supabase
      .from('documents')
      .select('id, line_items(id, quantity, custom_fields, garment_source)')
      .in('status', ['sent', 'approved', 'paid', 'partial', 'viewed', 'ach_pending'])
      .eq('doc_type', 'invoice')
      .eq('archived', false)

    let queueCount = 0
    for (const doc of docs || []) {
      for (const li of (doc as any).line_items || []) {
        const cf = li.custom_fields || {}
        if (
          cf.apparel_mode === true &&
          cf.supplier === 'sanmar' &&
          cf.item_number &&
          cf.item_number !== 'CUSPRO' &&
          cf.customer_provided !== true &&
          cf.garment_source !== 'customer_supplied' &&
          li.garment_source !== 'customer_supplied' &&
          cf.color &&
          li.quantity > 0 &&
          !alreadyOrdered.has(li.id)
        ) {
          queueCount++
        }
      }
    }

    // Count 2: POs with tracking status updates
    const { data: updatedPOs } = await supabase
      .from('purchase_orders')
      .select('id, tracking_info')
      .not('tracking_info', 'is', null)

    let updateCount = 0
    for (const po of updatedPOs || []) {
      if ((po.tracking_info as any)?.has_update) {
        updateCount++
      }
    }

    return NextResponse.json({ count: queueCount + updateCount })
  } catch (error) {
    console.error('Active PO count error:', error)
    return NextResponse.json({ count: 0 })
  }
}
