export const dynamic = 'force-dynamic'
export const revalidate = 0
import { supabase } from '../../lib/supabase'
import TaskBoard from './TaskBoard'

export default async function TasksPage() {
  console.log('[TasksPage] Fetching tasks from Supabase...')

  // Fetch all tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, description, status, priority, due_date, created_at, invoice_id, submission_id, quote_id, notes, started_at, time_spent_minutes, line_item_id, document_id')
    .order('created_at', { ascending: false })

  console.log('[TasksPage] Fetched tasks:', tasks?.length || 0, 'tasks')
  if (tasks && tasks.length > 0) {
    console.log('[TasksPage] First 3 tasks:', tasks.slice(0, 3).map(t => ({ id: t.id, title: t.title, status: t.status })))
  }

  // Fetch documents with customer info for invoice/quote linking
  const { data: documents } = await supabase
    .from('documents')
    .select(`
      id,
      doc_id,
      doc_number,
      type,
      customer_id,
      customers (
        id,
        display_name
      )
    `)
    .order('created_at', { ascending: false })

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <TaskBoard initialTasks={tasks || []} documents={documents || []} />
    </div>
  )
}
