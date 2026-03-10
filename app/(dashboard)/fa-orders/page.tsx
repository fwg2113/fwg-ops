export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@supabase/supabase-js'
import FAOrdersList from './FAOrdersList'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export default async function FAOrdersPage() {
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .filter('metadata->>source', 'eq', 'frederick-apparel')
    .order('created_at', { ascending: false })

  return <FAOrdersList initialOrders={orders || []} />
}
