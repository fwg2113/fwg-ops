export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@supabase/supabase-js'
import FAOrdersList from './FAOrdersList'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const APPAREL_CATEGORIES = ['EMBROIDERY', 'APPAREL', 'DTF_TRANSFER']

export default async function FAOrdersPage() {
  // Source 1: FA website orders
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .filter('metadata->>source', 'eq', 'frederick-apparel')
    .order('created_at', { ascending: false })

  const orderIds = (orders || []).map(o => o.id)

  let orderItems: any[] = []
  if (orderIds.length > 0) {
    const { data } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds)
    orderItems = data || []
  }

  const faOrders = (orders || []).map(o => ({
    ...o,
    order_items: orderItems.filter(i => i.order_id === o.id),
  }))

  // Source 2: FWG documents with apparel/embroidery/DTF line items
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .or('status.eq.paid,in_production.eq.true')
    .order('created_at', { ascending: false })

  const docIds = (docs || []).map(d => d.id)

  let lineItems: any[] = []
  if (docIds.length > 0) {
    const { data } = await supabase
      .from('line_items')
      .select('*')
      .in('document_id', docIds)
    lineItems = data || []
  }

  // Only include documents that have at least one apparel-related line item
  const documents = (docs || [])
    .map(d => ({
      ...d,
      line_items: lineItems.filter(li => li.document_id === d.id),
    }))
    .filter(d => d.line_items.some((li: any) => APPAREL_CATEGORIES.includes(li.category)))

  return <FAOrdersList faOrders={faOrders} documents={documents} />
}
