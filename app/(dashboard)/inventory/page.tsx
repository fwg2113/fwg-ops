export const dynamic = 'force-dynamic'
export const revalidate = 0

import { supabase } from '../../lib/supabase'
import InventoryPage from './InventoryPage'

export default async function Page() {
  const [vendorsRes] = await Promise.all([
    supabase.from('vendors').select('*').order('name'),
  ])

  return (
    <InventoryPage
      initialVendors={vendorsRes.data || []}
    />
  )
}
