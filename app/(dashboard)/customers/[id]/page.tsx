import { supabase } from '../../../lib/supabase'
import CustomerDetail from './CustomerDetail'

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  if (!customer) {
    return <div style={{ color: '#f1f5f9', padding: '40px' }}>Customer not found</div>
  }

  return <CustomerDetail customer={customer} documents={documents || []} />
}
