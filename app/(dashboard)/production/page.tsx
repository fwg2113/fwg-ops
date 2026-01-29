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
      type,
      status,
      customer_id,
      total,
      category,
      paid_at,
      customer_name,
      vehicle_description,
      project_description
    `)
    .eq('in_production', true)
    .order('created_at', { ascending: false })

  if (jobsError) {
    console.error('Error fetching production jobs:', jobsError)
  }

  // Fetch production tasks for these jobs
  const jobIds = productionJobs?.map(j => j.id) || []
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .in('invoice_id', jobIds)
    .order('created_at', { ascending: true })

  // Debug: Check what we're getting
  console.log('Production Jobs:', productionJobs)
  console.log('Tasks:', tasks)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      {/* Debug info */}
      <div style={{ marginBottom: '20px', padding: '10px', background: '#1d1d1d', borderRadius: '8px', fontSize: '12px', color: '#64748b' }}>
        Debug: Found {productionJobs?.length || 0} jobs in production and {tasks?.length || 0} tasks
      </div>
      <ProductionFlow
        initialJobs={productionJobs || []}
        initialTasks={tasks || []}
      />
    </div>
  )
}