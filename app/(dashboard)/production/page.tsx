export const dynamic = 'force-dynamic'
export const revalidate = 0
import { supabase } from '../../lib/supabase'
import ProductionFlow from './ProductionFlow'

export default async function ProductionPage() {
  // Fetch invoices in production
  const { data: productionJobs } = await supabase
    .from('documents')
    .select(`
      id,
      doc_id,
      doc_number,
      type,
      status,
      customer_id,
      total,
      category,
      paid_at,
      customers (
        id,
        display_name
      ),
      vehicle_info
    `)
    .eq('in_production', true)
    .order('created_at', { ascending: false })

  // Fetch production tasks for these jobs
  const jobIds = productionJobs?.map(j => j.doc_id) || []
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .in('invoice_id', jobIds)
    .order('created_at', { ascending: true })

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <ProductionFlow
        initialJobs={productionJobs || []}
        initialTasks={tasks || []}
      />
    </div>
  )
}