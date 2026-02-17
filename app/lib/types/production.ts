/**
 * Type definitions for Production Workflow System
 * Phase 1.2 - Data Migration
 */

// ============================================================================
// PROJECT TEMPLATES (Workflows)
// ============================================================================

export type ProjectTemplate = {
  id: string
  template_key: string
  category_key: string
  label: string
  description: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type ProjectTemplateInsert = Omit<ProjectTemplate, 'id' | 'created_at' | 'updated_at'>

// ============================================================================
// TEMPLATE TASKS (Workflow Steps)
// ============================================================================

export type TemplateTask = {
  id: string
  template_key: string
  task_key: string
  label: string
  instructions: string | null
  default_priority: string
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export type TemplateTaskInsert = Omit<TemplateTask, 'id' | 'instructions' | 'created_at' | 'updated_at'> & { instructions?: string | null }

// ============================================================================
// TEMPLATE WITH NESTED TASKS
// ============================================================================

export type ProjectTemplateWithTasks = ProjectTemplate & {
  tasks: TemplateTask[]
}

// ============================================================================
// TASK STATUSES
// ============================================================================

export type TaskStatus = {
  id: string
  status_key: string
  label: string
  color: string
  is_complete: boolean
  sort_order: number
  active: boolean
  created_at: string
}

export type TaskStatusInsert = Omit<TaskStatus, 'id' | 'created_at'>

// ============================================================================
// TASK PRIORITIES
// ============================================================================

export type TaskPriority = {
  id: string
  priority_key: string
  label: string
  color: string
  sort_order: number
  active: boolean
  created_at: string
}

export type TaskPriorityInsert = Omit<TaskPriority, 'id' | 'created_at'>

// ============================================================================
// INVOICE STATUSES
// ============================================================================

export type InvoiceStatus = {
  id: string
  status_key: string
  label: string
  color: string
  triggers_production: boolean
  sort_order: number
  active: boolean
  created_at: string
}

export type InvoiceStatusInsert = Omit<InvoiceStatus, 'id' | 'created_at'>

// ============================================================================
// UPDATED TASK TYPE (with new production workflow fields)
// ============================================================================

export type Task = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string | null
  created_at: string

  // Relationships
  invoice_id: string | null
  line_item_id: string | null        // NEW: Links to specific line item
  submission_id: string | null
  quote_id: string | null

  // Production workflow metadata
  auto_generated: boolean             // NEW: True if created from template
  sort_order: number                  // NEW: Order within line item workflow
  template_task_key: string | null    // NEW: References template_tasks.task_key

  // Additional fields
  notes: string | null
}

// ============================================================================
// GOOGLE SHEETS RAW DATA TYPES
// ============================================================================

/**
 * Raw data from Google Sheets ProjectTemplates tab
 * Before transformation to Supabase format
 */
export type LegacyProjectTemplate = {
  template_key: string
  category_key: string
  label: string
  description?: string
  active?: boolean | string
  sort_order?: number | string
}

/**
 * Raw data from Google Sheets TemplateTasks tab
 * Before transformation to Supabase format
 */
export type LegacyTemplateTask = {
  template_key: string
  task_key: string
  label: string
  default_priority?: string
  sort_order: number | string
  active?: boolean | string
}

// ============================================================================
// MIGRATION RESULT TYPES
// ============================================================================

export type MigrationResult = {
  success: boolean
  templatesCreated: number
  tasksCreated: number
  errors: string[]
  warnings: string[]
}

export type MigrationLog = {
  timestamp: string
  level: 'info' | 'warning' | 'error'
  message: string
  data?: any
}
