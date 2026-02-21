export const dynamic = 'force-dynamic'
export const revalidate = 0
import { supabase } from '../../lib/supabase'
import ProductionFlow from './ProductionFlow'

export default async function ProductionPage() {
  // Fetch invoices in production
  const { data: productionJobs, error: jobsError } = await supabase
    .from('documents')
    .select(`
      id,
      doc_number,
      doc_type,
      status,
      customer_id,
      total,
      category,
      paid_at,
      customer_name,
      vehicle_description,
      project_description,
      snoozed,
      snoozed_at
    `)
    .eq('in_production', true)
    .order('created_at', { ascending: false })

  if (jobsError) {
    console.error('Error fetching production jobs:', jobsError)
  }

  // Fetch production tasks for these jobs (excluding archived)
  const jobIds = productionJobs?.map(j => j.id) || []
  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      *,
      line_items:line_item_id (
        id,
        description,
        category
      )
    `)
    .in('document_id', jobIds)
    .eq('auto_generated', true)
    .or('archived.is.null,archived.eq.false')
    .order('sort_order', { ascending: true })

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <ProductionFlow
        initialJobs={productionJobs || []}
        initialTasks={tasks || []}
      />
    </div>
  )
}