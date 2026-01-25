import { supabase } from '../../lib/supabase'
import CustomerList from './CustomerList'

export default async function CustomersPage() {
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const { count } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })

  const { data: documents } = await supabase
    .from('documents')
    .select('id, customer_id')

  return <CustomerList initialCustomers={customers || []} totalCount={count || 0} />
}
