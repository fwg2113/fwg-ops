import { supabase } from '../../lib/supabase'
import TaskBoard from './components/TaskBoard'
import type { BoardData } from './types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HandsPage() {
  const [tasksRes, categoriesRes, locationsRes, teamRes, prizesRes, logRes, weeklyWinnersRes] = await Promise.all([
    supabase
      .from('nih_tasks')
      .select('*, nih_categories(*), nih_locations(*), nih_task_assignees(nih_team_members(*))')
      .order('sort_order', { ascending: true }),
    supabase.from('nih_categories').select('*').order('sort_order'),
    supabase.from('nih_locations').select('*').order('sort_order'),
    supabase.from('nih_team_members').select('*').eq('is_active', true).order('name'),
    supabase.from('nih_prizes').select('*').order('position', { ascending: true }),
    supabase.from('nih_completion_log').select('*').order('completed_at', { ascending: false }).limit(200),
    supabase.from('nih_weekly_winners').select('*').order('week_start', { ascending: false }).order('position', { ascending: true }).limit(3),
  ])

  // Filter to only the most recent week
  const allWinners = weeklyWinnersRes.data || []
  const latestWeek = allWinners[0]?.week_start
  const weeklyWinners = latestWeek ? allWinners.filter(w => w.week_start === latestWeek) : []

  const boardData: BoardData = {
    tasks: tasksRes.data || [],
    categories: categoriesRes.data || [],
    locations: locationsRes.data || [],
    teamMembers: teamRes.data || [],
    prizes: prizesRes.data || [],
    completionLog: logRes.data || [],
    weeklyWinners,
  }

  return <TaskBoard initialData={boardData} />
}
