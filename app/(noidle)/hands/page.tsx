import { supabase } from '../../lib/supabase'
import TaskBoard from './components/TaskBoard'
import type { BoardData } from './types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HandsPage() {
  const [tasksRes, categoriesRes, locationsRes, teamRes] = await Promise.all([
    supabase
      .from('nih_tasks')
      .select('*, nih_categories(*), nih_locations(*), nih_task_assignees(nih_team_members(*))')
      .order('sort_order', { ascending: true }),
    supabase.from('nih_categories').select('*').order('sort_order'),
    supabase.from('nih_locations').select('*').order('sort_order'),
    supabase.from('nih_team_members').select('*').eq('is_active', true).order('name'),
  ])

  const boardData: BoardData = {
    tasks: tasksRes.data || [],
    categories: categoriesRes.data || [],
    locations: locationsRes.data || [],
    teamMembers: teamRes.data || [],
  }

  return <TaskBoard initialData={boardData} />
}
