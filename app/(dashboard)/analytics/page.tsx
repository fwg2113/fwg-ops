export const dynamic = 'force-dynamic'
export const revalidate = 0
import { supabase } from '../../lib/supabase'
import AnalyticsDashboard from './AnalyticsDashboard'

export default async function AnalyticsPage() {
  // Fetch completed tasks with time tracking data
  const { data: completedTasks } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      template_task_key,
      time_spent_minutes,
      completed_at,
      created_at,
      document_id,
      line_item_id,
      line_items:line_item_id (
        id,
        category,
        description
      )
    `)
    .eq('status', 'COMPLETED')
    .not('time_spent_minutes', 'is', null)
    .gt('time_spent_minutes', 0)
    .order('completed_at', { ascending: false })

  // Fetch all production jobs for context
  const { data: productionJobs } = await supabase
    .from('documents')
    .select('id, doc_number, customer_name, category, total, created_at')
    .eq('in_production', true)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <AnalyticsDashboard
        completedTasks={(completedTasks || []).map(task => ({
          ...task,
          line_items: Array.isArray(task.line_items) ? task.line_items[0] : task.line_items
        }))}
        productionJobs={productionJobs || []}
      />
    </div>
  )
}
