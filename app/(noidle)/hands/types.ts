export interface NihTeamMember {
  id: string
  name: string
  role: string
  avatar_color: string
  is_active: boolean
  total_points: number
  created_at: string
}

export interface NihPrize {
  id: string
  position: number
  prize_text: string
  updated_at: string
}

export interface NihCategory {
  id: string
  name: string
  color: string
  sort_order: number
}

export interface NihLocation {
  id: string
  name: string
  sort_order: number
}

export interface NihTaskAssignee {
  task_id: string
  team_member_id: string
  nih_team_members: NihTeamMember
}

export interface NihTask {
  id: string
  title: string
  description: string | null
  category_id: string | null
  location_id: string | null
  urgency: 'low' | 'medium' | 'high' | 'critical'
  time_estimate: string | null
  status: 'open' | 'in_progress' | 'completed'
  is_project: boolean
  parent_id: string | null
  sort_order: number
  point_of_contact: string | null
  completion_notes: string | null
  completion_photo_url: string | null
  completed_at: string | null
  completed_by: string | null
  completed_by_names: string | null
  points: number
  is_recurring: boolean
  recurring_days: string[]
  created_by: string | null
  created_at: string
  updated_at: string
  nih_categories: NihCategory | null
  nih_locations: NihLocation | null
  nih_task_assignees: NihTaskAssignee[]
}

export interface BoardData {
  tasks: NihTask[]
  categories: NihCategory[]
  locations: NihLocation[]
  teamMembers: NihTeamMember[]
  prizes: NihPrize[]
  completionLog: NihCompletionLog[]
}

export type FilterState = {
  category: string | null
  urgency: string | null
  timeEstimate: string | null
  location: string | null
  assignee: string | null
  showCompleted: boolean
}

export const URGENCY_COLORS: Record<string, string> = {
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
}

export const URGENCY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}
export interface NihCompletionLog {
  id: string
  task_id: string | null
  task_title: string
  photo_url: string | null
  completion_notes: string | null
  completed_by_names: string | null
  completed_by_ids: string[]
  points_awarded: number
  completed_at: string
  created_at: string
}

export const TIME_ESTIMATES = [
  '15 min',
  '30 min',
  '1 hour',
  '2 hours',
  'Half day',
  'Full day',
  'Multi-day',
]
