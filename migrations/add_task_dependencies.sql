-- ============================================================================
-- Phase 5.2: Task Dependencies
-- Add dependency support to tasks and template_tasks tables
-- ============================================================================

-- Add depends_on_task_id to tasks table (runtime dependency)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS depends_on_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- Create index for dependency lookups
CREATE INDEX IF NOT EXISTS idx_tasks_depends_on
  ON tasks(depends_on_task_id)
  WHERE depends_on_task_id IS NOT NULL;

-- Add depends_on_task_key to template_tasks (template-level dependency definition)
ALTER TABLE template_tasks
  ADD COLUMN IF NOT EXISTS depends_on_task_key TEXT;

-- Add foreign key constraint to ensure depends_on_task_key references another task in same template
-- Note: This is a soft constraint - we'll validate in application logic since it's within same template

-- Add comments to document the fields
COMMENT ON COLUMN tasks.depends_on_task_id IS 'Task cannot be started/completed until this prerequisite task is completed';
COMMENT ON COLUMN template_tasks.depends_on_task_key IS 'Task key within same template that must be completed first (e.g., PRINT must complete before INSTALL)';
