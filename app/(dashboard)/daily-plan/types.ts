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
}

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
