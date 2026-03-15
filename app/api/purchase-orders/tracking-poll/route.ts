import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSanMarClient } from '@/app/lib/suppliers/sanmar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

/**
 * Fetch delivery status for a tracking number via EasyPost Tracker API.
 */
async function getDeliveryStatus(trackingCode: string, carrier: string) {
  const apiKey = process.env.EASYPOST_API_KEY
  if (!apiKey) return { status: 'unknown', statusDetail: '', estDeliveryDate: null, deliveredAt: null }

  try {
    const res = await fetch('https://api.easypost.com/v2/trackers', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tracker: { tracking_code: trackingCode, carrier: carrier || 'UPS' } }),
    })

    const data = await res.json()
    if (!res.ok) return { status: 'unknown', statusDetail: '', estDeliveryDate: null, deliveredAt: null }

    return {
      status: data.status || 'unknown',
      statusDetail: data.status_detail || '',
      estDeliveryDate: data.est_delivery_date || null,
      deliveredAt: data.status === 'delivered' && data.tracking_details?.length
        ? data.tracking_details[data.tracking_details.length - 1]?.datetime || null
        : null,
    }
  } catch {
    return { status: 'unknown', statusDetail: '', estDeliveryDate: null, deliveredAt: null }
  }
}

/**
 * GET /api/purchase-orders/tracking-poll
 *
 * Cron job endpoint: auto-fetches tracking + delivery status for all
 * non-delivered, non-cancelled POs that have been submitted.
 * Called every hour by Vercel cron.
 */
export async function GET() {
  try {
    // Get all POs that need tracking updates (submitted/confirmed/shipped — not delivered/cancelled)
    const { data: pos, error } = await supabase
      .from('purchase_orders')
      .select('id, po_number, status, tracking_info')
      .in('status', ['submitted', 'confirmed', 'shipped'])
      .order('created_at', { ascending: false })

    if (error || !pos?.length) {
      return NextResponse.json({ updated: 0, message: error ? 'DB error' : 'No POs to poll' })
    }

    const sanmarClient = getSanMarClient()
    let updated = 0
    let statusChanges = 0

    for (const po of pos) {
      try {
        // Fetch shipment info from SanMar
        const result = await sanmarClient.getOrderShipmentNotification(po.po_number)
        if (!result.success) continue

        const allPackages = result.salesOrders.flatMap(so => so.packages)
        const trackingNumbers = allPackages.map(p => p.trackingNumber).filter(Boolean)
        if (trackingNumbers.length === 0) continue

        const carriers = [...new Set(allPackages.map(p => p.carrier).filter(Boolean))]

        // Fetch delivery status for each tracking number
        const deliveryStatuses: Record<string, any> = {}
        for (const pkg of allPackages.filter(p => p.trackingNumber)) {
          deliveryStatuses[pkg.trackingNumber] = await getDeliveryStatus(pkg.trackingNumber, pkg.carrier)
        }

        // Compare with previous statuses to detect changes
        const prevStatuses = (po.tracking_info as any)?.delivery_statuses || {}
        let hasStatusChange = false
        for (const tn of trackingNumbers) {
          const prevStatus = prevStatuses[tn]?.status
          const newStatus = deliveryStatuses[tn]?.status
          if (prevStatus && newStatus && prevStatus !== newStatus) {
            hasStatusChange = true
          }
        }

        // Build updated tracking info
        const trackingInfo = {
          fetched_at: new Date().toISOString(),
          complete: result.complete,
          sales_orders: result.salesOrders,
          tracking_numbers: trackingNumbers,
          carriers,
          delivery_statuses: deliveryStatuses,
          // Flag for badge notification: set when status changes, cleared when user views PO history
          has_update: hasStatusChange || (po.tracking_info as any)?.has_update || false,
        }

        // Determine PO status update
        const updates: Record<string, any> = { tracking_info: trackingInfo }
        const allDelivered = trackingNumbers.every(tn => deliveryStatuses[tn]?.status === 'delivered')

        if (allDelivered) {
          updates.status = 'delivered'
        } else if (po.status === 'submitted' || po.status === 'confirmed') {
          updates.status = 'shipped'
        }

        await supabase.from('purchase_orders').update(updates).eq('id', po.id)
        updated++
        if (hasStatusChange) statusChanges++
      } catch (e) {
        console.error(`Tracking poll error for PO ${po.po_number}:`, e)
      }
    }

    return NextResponse.json({ updated, statusChanges, total: pos.length })
  } catch (error) {
    console.error('Tracking poll error:', error)
    return NextResponse.json({ error: 'Tracking poll failed' }, { status: 500 })
  }
}
