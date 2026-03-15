import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSanMarClient } from '@/app/lib/suppliers/sanmar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

/**
 * Fetch delivery status for a tracking number via EasyPost Tracker API.
 * Returns status like: pre_transit, in_transit, out_for_delivery, delivered, failure, unknown
 */
async function getDeliveryStatus(trackingCode: string, carrier: string): Promise<{
  status: string
  statusDetail: string
  estDeliveryDate: string | null
  deliveredAt: string | null
}> {
  const apiKey = process.env.EASYPOST_API_KEY
  if (!apiKey) return { status: 'unknown', statusDetail: '', estDeliveryDate: null, deliveredAt: null }

  try {
    const res = await fetch('https://api.easypost.com/v2/trackers', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tracker: {
          tracking_code: trackingCode,
          carrier: carrier || 'UPS',
        },
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('EasyPost tracker error:', data)
      return { status: 'unknown', statusDetail: '', estDeliveryDate: null, deliveredAt: null }
    }

    return {
      status: data.status || 'unknown',
      statusDetail: data.status_detail || '',
      estDeliveryDate: data.est_delivery_date || null,
      deliveredAt: data.status === 'delivered' && data.tracking_details?.length
        ? data.tracking_details[data.tracking_details.length - 1]?.datetime || null
        : null,
    }
  } catch (e) {
    console.error('EasyPost tracker fetch failed:', e)
    return { status: 'unknown', statusDetail: '', estDeliveryDate: null, deliveredAt: null }
  }
}

/**
 * POST /api/purchase-orders/tracking
 *
 * Fetches shipment/tracking info from SanMar's PromoStandards API
 * for a given PO number, then checks delivery status via EasyPost.
 * Saves all tracking data to the purchase_orders table.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { po_id, po_number } = body

  if (!po_id || !po_number) {
    return NextResponse.json({ error: 'po_id and po_number required' }, { status: 400 })
  }

  try {
    const client = getSanMarClient()
    const result = await client.getOrderShipmentNotification(po_number)

    if (!result.success) {
      return NextResponse.json({
        error: result.errorMessage || 'Failed to fetch tracking info',
        details: result.rawResponse?.substring(0, 500),
      }, { status: 400 })
    }

    // Extract all tracking numbers from all packages
    const allPackages = result.salesOrders.flatMap(so => so.packages)
    const trackingNumbers = allPackages.map(p => p.trackingNumber).filter(Boolean)
    const carriers = [...new Set(allPackages.map(p => p.carrier).filter(Boolean))]

    // Fetch delivery status for each tracking number via EasyPost
    const deliveryStatuses: Record<string, { status: string; statusDetail: string; estDeliveryDate: string | null; deliveredAt: string | null }> = {}
    if (trackingNumbers.length > 0) {
      const statusPromises = allPackages
        .filter(p => p.trackingNumber)
        .map(async (p) => {
          const status = await getDeliveryStatus(p.trackingNumber, p.carrier)
          deliveryStatuses[p.trackingNumber] = status
        })
      await Promise.all(statusPromises)
    }

    // Build tracking info object to store
    // Manual fetch clears the has_update flag (user is viewing it)
    const trackingInfo = {
      fetched_at: new Date().toISOString(),
      complete: result.complete,
      sales_orders: result.salesOrders,
      tracking_numbers: trackingNumbers,
      carriers,
      delivery_statuses: deliveryStatuses,
      has_update: false,
    }

    // Auto-update PO status based on delivery info
    const updates: Record<string, any> = {
      tracking_info: trackingInfo,
    }

    if (trackingNumbers.length > 0) {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('status')
        .eq('id', po_id)
        .single()

      if (po) {
        const allDelivered = trackingNumbers.length > 0 &&
          trackingNumbers.every(tn => deliveryStatuses[tn]?.status === 'delivered')

        if (allDelivered && ['submitted', 'confirmed', 'shipped'].includes(po.status)) {
          updates.status = 'delivered'
        } else if (['submitted', 'confirmed'].includes(po.status)) {
          updates.status = 'shipped'
        }
      }
    }

    await supabase
      .from('purchase_orders')
      .update(updates)
      .eq('id', po_id)

    return NextResponse.json({
      success: true,
      tracking_numbers: trackingNumbers,
      carriers,
      complete: result.complete,
      sales_orders: result.salesOrders,
      delivery_statuses: deliveryStatuses,
    })
  } catch (error) {
    console.error('PO tracking fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch tracking info from SanMar' }, { status: 500 })
  }
}
