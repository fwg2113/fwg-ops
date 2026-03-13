import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSanMarClient } from '../../lib/suppliers/sanmar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// Hardcoded shipping info (user chose "always same address + UPS Ground")
const SHIP_CONFIG = {
  shipTo: process.env.SANMAR_SHIP_TO || 'Frederick Wraps',
  shipAddress1: process.env.SANMAR_SHIP_ADDRESS1 || '',
  shipAddress2: process.env.SANMAR_SHIP_ADDRESS2 || '',
  shipCity: process.env.SANMAR_SHIP_CITY || '',
  shipState: process.env.SANMAR_SHIP_STATE || '',
  shipZip: process.env.SANMAR_SHIP_ZIP || '',
  shipMethod: 'UPS',
  shipEmail: process.env.SANMAR_SHIP_EMAIL || '',
  residence: 'N',
}

/**
 * GET /api/purchase-orders
 *
 * Returns purchase order history with items.
 */
export async function GET() {
  try {
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching purchase orders:', error)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    // Get items for each order
    const orderIds = (orders || []).map(o => o.id)
    let items: any[] = []
    if (orderIds.length > 0) {
      const { data: poItems } = await supabase
        .from('purchase_order_items')
        .select('*')
        .in('purchase_order_id', orderIds)
        .order('created_at', { ascending: true })
      items = poItems || []
    }

    // Group items by order
    const itemsByOrder: Record<string, any[]> = {}
    for (const item of items) {
      if (!itemsByOrder[item.purchase_order_id]) {
        itemsByOrder[item.purchase_order_id] = []
      }
      itemsByOrder[item.purchase_order_id].push(item)
    }

    const result = (orders || []).map(order => ({
      ...order,
      items: itemsByOrder[order.id] || [],
    }))

    return NextResponse.json({ orders: result })
  } catch (error) {
    console.error('Purchase orders GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/purchase-orders
 *
 * Submits a purchase order to SanMar.
 * Two-step process:
 * 1. getPreSubmitInfo (validate inventory)
 * 2. submitPO (actual submission)
 *
 * Body: {
 *   items: Array<{
 *     lineItemId: string,  // source line_item.id
 *     documentId: string,  // source document.id
 *     documentNumber: string,
 *     customerName: string,
 *     style: string,
 *     color: string,
 *     catalogColor: string,
 *     size: string,
 *     quantity: number,
 *     inventoryKey?: number,
 *     sizeIndex?: number,
 *     wholesalePrice?: number,
 *   }>
 *   skipValidation?: boolean  // skip getPreSubmitInfo (not recommended)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, skipValidation } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    // Validate shipping config
    if (!SHIP_CONFIG.shipAddress1 || !SHIP_CONFIG.shipCity || !SHIP_CONFIG.shipState || !SHIP_CONFIG.shipZip) {
      return NextResponse.json({
        error: 'Shipping address not configured. Set SANMAR_SHIP_ADDRESS1, SANMAR_SHIP_CITY, SANMAR_SHIP_STATE, SANMAR_SHIP_ZIP in environment variables.'
      }, { status: 400 })
    }

    const client = getSanMarClient()

    // Generate PO number: FWG-MMDDYY-HHMM
    const now = new Date()
    const poNum = `FWG-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`

    // Build SanMar item list (use catalogColor for ordering, fallback to display color)
    const sanmarItems = items.map((item: any) => ({
      style: item.style,
      color: item.catalogColor || item.color,
      size: item.size,
      quantity: item.quantity,
      inventoryKey: item.inventoryKey,
      sizeIndex: item.sizeIndex,
      whseNo: undefined as string | undefined,
      // preserve source tracking fields
      lineItemId: item.lineItemId,
      documentId: item.documentId,
      documentNumber: item.documentNumber,
      customerName: item.customerName,
      catalogColor: item.catalogColor,
      wholesalePrice: item.wholesalePrice,
    }))

    const poParams = {
      poNum,
      ...SHIP_CONFIG,
      items: sanmarItems,
    }

    // Step 1: Validate inventory (unless skipped)
    let validationResult = null
    if (!skipValidation) {
      try {
        validationResult = await client.getPreSubmitInfo(poParams)

        if (!validationResult.success) {
          // Some items may not be available — return the validation details
          // Create the PO record with 'error' status for tracking
          const { data: po } = await supabase.from('purchase_orders').insert({
            po_number: poNum,
            supplier: 'sanmar',
            status: 'error',
            ...SHIP_CONFIG,
            ship_to: SHIP_CONFIG.shipTo,
            ship_address1: SHIP_CONFIG.shipAddress1,
            ship_address2: SHIP_CONFIG.shipAddress2,
            ship_city: SHIP_CONFIG.shipCity,
            ship_state: SHIP_CONFIG.shipState,
            ship_zip: SHIP_CONFIG.shipZip,
            ship_method: SHIP_CONFIG.shipMethod,
            ship_email: SHIP_CONFIG.shipEmail,
            total_items: items.length,
            total_units: items.reduce((sum: number, i: any) => sum + i.quantity, 0),
            total_cost: items.reduce((sum: number, i: any) => sum + (i.quantity * (i.wholesalePrice || 0)), 0),
            supplier_response: validationResult,
            notes: `Validation failed: ${validationResult.message}`,
          }).select().single()

          // Insert items even for failed POs (for tracking)
          if (po) {
            const poItemRows = items.map((item: any) => {
              const validationItem = validationResult!.items.find(
                (vi: any) => vi.style === item.style && vi.size === item.size
              )
              return {
                purchase_order_id: po.id,
                source_document_id: item.documentId,
                source_line_item_id: item.lineItemId,
                source_document_number: item.documentNumber,
                customer_name: item.customerName,
                supplier: 'sanmar',
                style: item.style,
                color: item.color,
                catalog_color: item.catalogColor,
                size: item.size,
                quantity: item.quantity,
                inventory_key: item.inventoryKey,
                size_index: item.sizeIndex,
                wholesale_price: item.wholesalePrice,
                line_cost: item.quantity * (item.wholesalePrice || 0),
                warehouse_id: validationItem?.whseNo ? parseInt(validationItem.whseNo, 10) : null,
                status: validationItem?.available ? 'pending' : 'backordered',
              }
            })
            await supabase.from('purchase_order_items').insert(poItemRows)
          }

          return NextResponse.json({
            success: false,
            poNumber: poNum,
            poId: po?.id,
            message: validationResult.message,
            validation: validationResult,
          }, { status: 200 })
        }
      } catch (validationError) {
        console.error('Pre-submit validation error:', validationError)
        return NextResponse.json({
          error: 'Failed to validate inventory with SanMar',
          details: String(validationError),
        }, { status: 502 })
      }
    }

    // Enrich items with warehouse assignments from validation
    // Prefer warehouse 5 (Virginia / Dulles) when validation confirmed it;
    // otherwise use the warehouse SanMar suggested (closest to ship address).
    if (validationResult?.items) {
      for (const sanmarItem of sanmarItems) {
        const validated = validationResult.items.find(
          (vi: any) => vi.style === sanmarItem.style && vi.size === sanmarItem.size && vi.color === sanmarItem.color
        )
        if (validated?.whseNo) {
          sanmarItem.whseNo = validated.whseNo
        }
      }
    }

    // Step 2: Submit the PO
    let submitResult
    try {
      submitResult = await client.submitPO(poParams)
    } catch (submitError) {
      console.error('PO submission error:', submitError)
      return NextResponse.json({
        error: 'Failed to submit PO to SanMar',
        details: String(submitError),
      }, { status: 502 })
    }

    // Store the PO in our database
    const totalUnits = items.reduce((sum: number, i: any) => sum + i.quantity, 0)
    const totalCost = items.reduce((sum: number, i: any) => sum + (i.quantity * (i.wholesalePrice || 0)), 0)

    const { data: po, error: poError } = await supabase.from('purchase_orders').insert({
      po_number: poNum,
      supplier: 'sanmar',
      status: submitResult.success ? 'submitted' : 'error',
      ship_to: SHIP_CONFIG.shipTo,
      ship_address1: SHIP_CONFIG.shipAddress1,
      ship_address2: SHIP_CONFIG.shipAddress2,
      ship_city: SHIP_CONFIG.shipCity,
      ship_state: SHIP_CONFIG.shipState,
      ship_zip: SHIP_CONFIG.shipZip,
      ship_method: SHIP_CONFIG.shipMethod,
      ship_email: SHIP_CONFIG.shipEmail,
      total_items: items.length,
      total_units: totalUnits,
      total_cost: totalCost,
      supplier_confirmation: submitResult.success ? submitResult.message : null,
      supplier_response: {
        submit: { success: submitResult.success, message: submitResult.message },
        validation: validationResult,
      },
      submitted_at: submitResult.success ? new Date().toISOString() : null,
      notes: submitResult.success ? null : `Submission failed: ${submitResult.message}`,
    }).select().single()

    if (poError) {
      console.error('Error saving PO to database:', poError)
      // PO was submitted to SanMar but we failed to save locally — still return success
      return NextResponse.json({
        success: submitResult.success,
        poNumber: poNum,
        message: submitResult.message,
        warning: 'PO submitted to SanMar but failed to save to local database',
      })
    }

    // Insert PO items
    const poItemRows = items.map((item: any) => {
      const validationItem = validationResult?.items?.find(
        (vi: any) => vi.style === item.style && vi.size === item.size
      )
      return {
        purchase_order_id: po.id,
        source_document_id: item.documentId,
        source_line_item_id: item.lineItemId,
        source_document_number: item.documentNumber,
        customer_name: item.customerName,
        supplier: 'sanmar',
        style: item.style,
        color: item.color,
        catalog_color: item.catalogColor,
        size: item.size,
        quantity: item.quantity,
        inventory_key: item.inventoryKey,
        size_index: item.sizeIndex,
        wholesale_price: item.wholesalePrice,
        line_cost: item.quantity * (item.wholesalePrice || 0),
        warehouse_id: validationItem?.whseNo ? parseInt(validationItem.whseNo, 10) : null,
        warehouse_name: validationItem?.whseNo ? getWarehouseName(validationItem.whseNo) : null,
        status: submitResult.success ? 'submitted' : 'cancelled',
      }
    })

    const { error: poItemsError } = await supabase.from('purchase_order_items').insert(poItemRows)
    if (poItemsError) {
      console.error('Failed to insert purchase_order_items:', poItemsError)
    }

    return NextResponse.json({
      success: submitResult.success,
      poNumber: poNum,
      poId: po.id,
      message: submitResult.message,
      totalUnits,
      totalCost,
    })
  } catch (error) {
    console.error('Purchase order POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/purchase-orders
 *
 * Updates a purchase order's status.
 * Body: { id: string, status: string, notes?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { id, status, notes } = await request.json()

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
    }

    const validStatuses = ['draft', 'submitted', 'confirmed', 'shipped', 'delivered', 'cancelled', 'error']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
    }

    const update: Record<string, any> = { status }
    if (notes !== undefined) update.notes = notes

    const { data, error } = await supabase
      .from('purchase_orders')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating purchase order:', error)
      return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 })
    }

    return NextResponse.json({ success: true, order: data })
  } catch (error) {
    console.error('Purchase order PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getWarehouseName(whseNo: string): string {
  const names: Record<string, string> = {
    '1': 'Seattle', '2': 'Cincinnati', '3': 'Dallas', '4': 'Reno',
    '5': 'Virginia (Dulles)', '6': 'Jacksonville', '7': 'Minneapolis',
    '12': 'Phoenix', '31': 'Richmond',
  }
  return names[whseNo] || `Warehouse ${whseNo}`
}
