export const dynamic = 'force-dynamic'
export const revalidate = 0
import { supabase } from '../../lib/supabase'
import TaskBoard from './TaskBoard'

export default async function TasksPage() {
  console.log('[TasksPage] Fetching tasks from Supabase...')

  // Fetch manual tasks only (exclude auto-generated production tasks)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .or('archived.is.null,archived.eq.false')
    .or('auto_generated.is.null,auto_generated.eq.false')
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

  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('id, name, short_name, color, role')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  const { data: taskAssignments } = await supabase
    .from('task_assignments')
    .select('task_id, team_member_id')

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <TaskBoard initialTasks={tasks || []} documents={documents || []} teamMembers={teamMembers || []} initialAssignments={taskAssignments || []} />
    </div>
  )
}
