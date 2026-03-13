import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

/**
 * GET /api/purchase-orders/aggregate
 *
 * Fetches all SanMar apparel line items from sent/approved invoices
 * that are ready to be included in a purchase order.
 *
 * Groups items by document for easy display in the PO page.
 */
export async function GET() {
  try {
    // 1. Get all invoices that are "sent" or have been approved/paid
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, doc_number, doc_type, customer_name, status, created_at')
      .eq('doc_type', 'invoice')
      .in('status', ['sent', 'approved', 'paid', 'partial', 'viewed', 'ach_pending'])
      .neq('status', 'archived')
      .order('created_at', { ascending: false })

    if (docError) {
      console.error('Error fetching documents:', docError)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ items: [], documents: [] })
    }

    const documentIds = documents.map(d => d.id)

    // 2. Get all line items from these documents that are SanMar apparel
    const { data: lineItems, error: liError } = await supabase
      .from('line_items')
      .select('id, document_id, description, quantity, unit_price, line_total, custom_fields, category')
      .in('document_id', documentIds)

    if (liError) {
      console.error('Error fetching line items:', liError)
      return NextResponse.json({ error: 'Failed to fetch line items' }, { status: 500 })
    }

    // 2.5. Get line item IDs that have already been ordered
    const allLineItemIds = (lineItems || []).map(li => li.id)
    const alreadyOrderedSet = new Set<string>()
    if (allLineItemIds.length > 0) {
      const { data: orderedItems } = await supabase
        .from('purchase_order_items')
        .select('source_line_item_id')
        .in('source_line_item_id', allLineItemIds)
      if (orderedItems) {
        for (const oi of orderedItems) {
          alreadyOrderedSet.add(oi.source_line_item_id)
        }
      }
    }

    // 3. Filter to SanMar apparel items with quantities, excluding already-ordered and customer-provided
    const sanmarItems = (lineItems || []).filter(li => {
      const cf = li.custom_fields || {}
      return cf.apparel_mode === true &&
        cf.supplier === 'sanmar' &&
        cf.item_number &&
        cf.item_number !== 'CUSPRO' &&
        cf.customer_provided !== true &&
        cf.garment_source !== 'customer_supplied' &&
        cf.color &&
        li.quantity > 0 &&
        !alreadyOrderedSet.has(li.id)
    })

    // 4. Check which items have already been ordered (in purchase_order_items)
    const lineItemIds = sanmarItems.map(li => li.id)
    let orderedItemMap: Record<string, { po_number: string; status: string; quantity: number }[]> = {}

    if (lineItemIds.length > 0) {
      const { data: poItems } = await supabase
        .from('purchase_order_items')
        .select('source_line_item_id, purchase_order_id, quantity, status')
        .in('source_line_item_id', lineItemIds)

      if (poItems && poItems.length > 0) {
        // Get PO numbers for these items
        const poIds = [...new Set(poItems.map(p => p.purchase_order_id))]
        const { data: pos } = await supabase
          .from('purchase_orders')
          .select('id, po_number, status')
          .in('id', poIds)

        const poMap = new Map((pos || []).map(p => [p.id, p]))

        for (const pi of poItems) {
          const po = poMap.get(pi.purchase_order_id)
          if (!po) continue
          if (!orderedItemMap[pi.source_line_item_id]) {
            orderedItemMap[pi.source_line_item_id] = []
          }
          orderedItemMap[pi.source_line_item_id].push({
            po_number: po.po_number,
            status: po.status,
            quantity: pi.quantity,
          })
        }
      }
    }

    // 5. Build response grouped by document
    const docMap = new Map(documents.map(d => [d.id, d]))
    const groupedItems: Record<string, {
      document: typeof documents[0]
      items: Array<{
        lineItemId: string
        style: string
        color: string
        catalogColor?: string
        description: string
        category: string
        imageUrl?: string
        sizes: Record<string, { qty: number; price: number; wholesale: number; inventoryKey?: number; sizeIndex?: number }>
        totalQty: number
        totalWholesale: number
        previousOrders: Array<{ po_number: string; status: string; quantity: number }>
      }>
    }> = {}

    for (const li of sanmarItems) {
      const cf = li.custom_fields || {}
      const docId = li.document_id
      const doc = docMap.get(docId)
      if (!doc) continue

      if (!groupedItems[docId]) {
        groupedItems[docId] = { document: doc, items: [] }
      }

      const sizes = cf.sizes || {}
      let totalQty = 0
      let totalWholesale = 0
      for (const s of Object.values(sizes) as any[]) {
        totalQty += s.qty || 0
        totalWholesale += (s.qty || 0) * (s.wholesale || 0)
      }

      groupedItems[docId].items.push({
        lineItemId: li.id,
        style: cf.item_number,
        color: cf.color,
        catalogColor: cf.catalog_color,
        description: li.description,
        category: li.category || '',
        imageUrl: cf.product_image_url || undefined,
        sizes,
        totalQty,
        totalWholesale,
        garmentSource: cf.garment_source || 'sanmar',
        previousOrders: orderedItemMap[li.id] || [],
      })
    }

    // Convert to array and filter out empty groups
    const result = Object.values(groupedItems).filter(g => g.items.length > 0)

    return NextResponse.json({
      groups: result,
      totalItems: sanmarItems.length,
    })
  } catch (error) {
    console.error('Purchase order aggregate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
