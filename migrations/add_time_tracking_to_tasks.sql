-- ============================================================================
-- Phase 5.3: Time Tracking
-- Add time tracking fields to tasks table
-- ============================================================================

-- Add started_at to track when timer was started
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Add time_spent_minutes to track accumulated time on task
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS time_spent_minutes INTEGER DEFAULT 0;

-- Create index for active timers (tasks with started_at set)
CREATE INDEX IF NOT EXISTS idx_tasks_timer_active
  ON tasks(started_at)
  WHERE started_at IS NOT NULL;

-- Add comment to document the fields
COMMENT ON COLUMN tasks.started_at IS 'Timer start time - null when timer is not running';
COMMENT ON COLUMN tasks.time_spent_minutes IS 'Total time spent on task in minutes (accumulated across multiple timer sessions)';
