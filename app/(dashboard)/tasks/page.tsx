export const dynamic = 'force-dynamic'
export const revalidate = 0
import { supabase } from '../../lib/supabase'
import TaskBoard from './TaskBoard'

export default async function TasksPage() {
  // Fetch all tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <TaskBoard initialTasks={tasks || []} />
    </div>
  )
}
