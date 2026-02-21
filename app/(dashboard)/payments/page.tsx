export const dynamic = 'force-dynamic'
export const revalidate = 0

import { supabase } from '../../lib/supabase'
import PaymentList from './PaymentList'

export default async function PaymentsPage() {
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id,
      document_id,
      amount,
      processing_fee,
      payment_method,
      processor,
      processor_txn_id,
      status,
      notes,
      synced_to_sheets,
      read,
      created_at,
      documents!inner(
        doc_number,
        doc_type,
        customer_name,
        company_name,
        category,
        project_description,
        vehicle_description,
        total,
        amount_paid,
        balance_due
      )
    `)
    .order('created_at', { ascending: false })

  return <PaymentList initialPayments={payments || []} />
}
