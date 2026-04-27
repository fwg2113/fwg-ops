// Shared types for the Daily Plan page

export type DailyTask = {
  id: string
  title: string
  description?: string | null
  scheduled_date: string | null
  is_priority: boolean
  parent_document_id: string | null
  status: 'TODO' | 'DONE'
  completed_at: string | null
  sort_order: number
  source: 'manual' | 'template' | 'recurring'
  recurring_task_id: string | null
  created_at: string
  updated_at: string
}

export type DailyTaskAssignment = { task_id: string; team_member_id: string }

export type RecurringTask = {
  id: string
  title: string
  description: string | null
  pattern: string
  default_assignee_id: string | null
  default_priority: boolean
  active: boolean
  last_spawned_date: string | null
  created_at: string
  updated_at: string
}

export type TeamMember = {
  id: string
  name: string
  short_name?: string
  color: string
  role?: string
}

// ----------------------------------------------------------------------------
// Display + ordering helpers for team members
// ----------------------------------------------------------------------------

// Preferred ordering for the daily-plan member filter row. Members not listed
// here fall through to the end (preserving DB sort_order among themselves).
export const MEMBER_FILTER_ORDER = [
  'Joey', 'Diogo', 'Mason', 'Sydney', 'Sharyn',
  'Trinity', 'Joe', 'Mikey', 'Bronson', 'Danny',
]

function memberFirstName(m: TeamMember): string {
  return (m.short_name || m.name || '').trim().split(/\s+/)[0]
}

// Compact chip label used in member filters and task-line assignee chips.
// Default is the first 3 letters uppercase. "Joey" gets spelled out in full
// (his preference — distinguishes him from "Joe" who else is on the team).
export function memberChipLabel(m: TeamMember): string {
  const fn = memberFirstName(m)
  if (fn.toLowerCase() === 'joey') return 'JOEY'
  return fn.slice(0, 3).toUpperCase()
}

// Comparator that orders by MEMBER_FILTER_ORDER first; unknown members tie at end.
export function sortMembersForFilter(a: TeamMember, b: TeamMember): number {
  const fa = memberFirstName(a).toLowerCase()
  const fb = memberFirstName(b).toLowerCase()
  const ia = MEMBER_FILTER_ORDER.findIndex(n => n.toLowerCase() === fa)
  const ib = MEMBER_FILTER_ORDER.findIndex(n => n.toLowerCase() === fb)
  if (ia === -1 && ib === -1) return 0
  if (ia === -1) return 1
  if (ib === -1) return -1
  return ia - ib
}

export type DocSummary = {
  id: string
  doc_number: string
  doc_type: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  customer_id?: string | null
  company_name?: string
  vehicle_description?: string
  project_description?: string
  total: number
  amount_paid?: number
  balance_due?: number
  due_date?: string | null
  fulfillment_type?: string | null
  production_stage?: string
  production_target_date?: string | null
  production_status_id?: string | null
  production_status_note?: string | null
  production_leader_id?: string | null
  status: string
  in_production: boolean
  attachments?: any[]
  notes?: any
  bucket?: string | null
  project_color?: string | null
}

// Standard project color palette — keep this short so the picker is fast to scan.
export const PROJECT_COLORS: { name: string; hex: string }[] = [
  { name: 'Cyan',   hex: '#22d3ee' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Pink',   hex: '#ec4899' },
  { name: 'Orange', hex: '#fb923c' },
  { name: 'Amber',  hex: '#f59e0b' },
  { name: 'Lime',   hex: '#84cc16' },
  { name: 'Green',  hex: '#22c55e' },
  { name: 'Teal',   hex: '#14b8a6' },
  { name: 'Blue',   hex: '#3b82f6' },
  { name: 'Red',    hex: '#ef4444' },
]

export type LineItemFull = {
  id: string
  document_id: string
  category: string
  line_type?: string
  description?: string
  quantity?: number
  unit_price?: number
  line_total?: number
  sort_order?: number
  attachments?: any[]
}

export type PaymentLite = {
  id: string
  document_id: string
  amount: number | string
  processing_fee?: number | string | null
  method?: string | null
  status?: string | null
  note?: string | null
  created_at: string
}

export type LineItemLite = {
  id: string
  document_id: string
  category: string
  line_type?: string
  description?: string
  attachments?: any[]
}

export type ProductionStatusLite = {
  id: string
  stage_key: string
  label: string
  color: string
}

export type CategoryLite = {
  category_key: string
  parent_category: string
  label: string
}

export type PipelineConfig = {
  category_key: string
  track: string
  track_label: string
  task_key: string
  task_label: string
  task_icon: string | null
  sort_order: number
}

export type CalendarEventLite = {
  id: string
  title: string | null
  event_type: string | null
  start_time: string | null
  end_time: string | null
  vehicle_start: string | null
  vehicle_end: string | null
  install_start: string | null
  install_end: string | null
  customer_name: string | null
  customer_phone: string | null
  vehicle_description: string | null
  document_id: string | null
  status: string | null
  notes: string | null
  category: string | null
}

// Bucket key — either an ISO date OR special string
export type BucketKey = string  // 'priority' | 'unscheduled' | 'next-week' | 'done-today' | 'YYYY-MM-DD'

export const SPECIAL_BUCKETS = {
  PRIORITY: 'priority',
  NEXT_WEEK: 'next-week',
  UNSCHEDULED: 'unscheduled',
  DONE_TODAY: 'done-today',
} as const
