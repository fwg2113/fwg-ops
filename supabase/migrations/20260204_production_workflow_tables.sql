-- ============================================================================
-- FWG Ops - Production Workflow System Migration
-- Created: 2026-02-04
-- Phase: 1.1 - Database Foundation
-- ============================================================================
--
-- This migration creates all tables needed for the production workflow system:
-- 1. project_templates - Workflow templates per category
-- 2. template_tasks - Task steps within each template
-- 3. task_statuses - Configurable task statuses
-- 4. task_priorities - Configurable priority levels
-- 5. invoice_statuses - Invoice status options (future automation)
-- 6. Updates to existing tasks table
--
-- ============================================================================

-- ============================================================================
-- 1. PROJECT TEMPLATES (Workflows)
-- ============================================================================
-- Each category (PPF, FULL_WRAP, TINT, etc.) has a template that defines
-- the production workflow for that type of job.
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  category_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 10 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_templates_category
  ON project_templates(category_key);
CREATE INDEX IF NOT EXISTS idx_project_templates_active
  ON project_templates(active) WHERE active = true;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_templates_updated_at
  BEFORE UPDATE ON project_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE project_templates IS 'Production workflow templates, each linked to a category (e.g., FULL_WRAP_WORKFLOW for Full Wrap category)';
COMMENT ON COLUMN project_templates.template_key IS 'Unique identifier for the template (e.g., FULL_WRAP_WORKFLOW)';
COMMENT ON COLUMN project_templates.category_key IS 'References the job category this template applies to';

-- ============================================================================
-- 2. TEMPLATE TASKS (Workflow Steps)
-- ============================================================================
-- Each template has multiple tasks that define the production workflow.
-- When an invoice line item enters production, these tasks are auto-generated.
-- ============================================================================

CREATE TABLE IF NOT EXISTS template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  task_key TEXT NOT NULL,
  label TEXT NOT NULL,
  default_priority TEXT DEFAULT 'MEDIUM' NOT NULL,
  sort_order INTEGER NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Composite unique constraint: each task_key must be unique within a template
  UNIQUE(template_key, task_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_template_tasks_template
  ON template_tasks(template_key);
CREATE INDEX IF NOT EXISTS idx_template_tasks_active
  ON template_tasks(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_template_tasks_sort
  ON template_tasks(template_key, sort_order);

-- Updated timestamp trigger
CREATE TRIGGER update_template_tasks_updated_at
  BEFORE UPDATE ON template_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE template_tasks IS 'Individual task steps within a workflow template (e.g., Verify → Design → Print → Install)';
COMMENT ON COLUMN template_tasks.template_key IS 'References project_templates.template_key';
COMMENT ON COLUMN template_tasks.task_key IS 'Unique key within this template (e.g., VERIFY, PRINT, INSTALL)';
COMMENT ON COLUMN template_tasks.sort_order IS 'Determines the order tasks appear in the production pipeline';

-- ============================================================================
-- 3. TASK STATUSES (Configurable)
-- ============================================================================
-- Defines available task statuses (e.g., TODO, IN_PROGRESS, COMPLETED).
-- Configurable via System Settings.
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#64748b' NOT NULL,
  is_complete BOOLEAN DEFAULT false NOT NULL,
  sort_order INTEGER DEFAULT 10 NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for active statuses
CREATE INDEX IF NOT EXISTS idx_task_statuses_active
  ON task_statuses(active) WHERE active = true;

COMMENT ON TABLE task_statuses IS 'Configurable task statuses (e.g., TODO, IN_PROGRESS, COMPLETED)';
COMMENT ON COLUMN task_statuses.is_complete IS 'When true, tasks with this status are considered finished';

-- Seed default task statuses
INSERT INTO task_statuses (status_key, label, color, is_complete, sort_order) VALUES
  ('TODO', 'To Do', '#64748b', false, 1),
  ('IN_PROGRESS', 'In Progress', '#3b82f6', false, 2),
  ('COMPLETED', 'Completed', '#22c55e', true, 3)
ON CONFLICT (status_key) DO NOTHING;

-- ============================================================================
-- 4. TASK PRIORITIES (Configurable)
-- ============================================================================
-- Defines available priority levels (e.g., URGENT, HIGH, MEDIUM, LOW).
-- Configurable via System Settings.
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority_key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#64748b' NOT NULL,
  sort_order INTEGER DEFAULT 10 NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for active priorities
CREATE INDEX IF NOT EXISTS idx_task_priorities_active
  ON task_priorities(active) WHERE active = true;

COMMENT ON TABLE task_priorities IS 'Configurable task priority levels (e.g., URGENT, HIGH, MEDIUM, LOW)';

-- Seed default task priorities
INSERT INTO task_priorities (priority_key, label, color, sort_order) VALUES
  ('URGENT', 'Urgent', '#ef4444', 1),
  ('HIGH', 'High', '#f97316', 2),
  ('MEDIUM', 'Medium', '#eab308', 3),
  ('LOW', 'Low', '#6b7280', 4)
ON CONFLICT (priority_key) DO NOTHING;

-- ============================================================================
-- 5. INVOICE STATUSES (Optional - for future automation)
-- ============================================================================
-- Defines invoice status options with automation triggers.
-- Example: When status changes to "Paid", auto-generate production tasks.
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#64748b' NOT NULL,
  triggers_production BOOLEAN DEFAULT false NOT NULL,
  sort_order INTEGER DEFAULT 10 NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for active statuses
CREATE INDEX IF NOT EXISTS idx_invoice_statuses_active
  ON invoice_statuses(active) WHERE active = true;

COMMENT ON TABLE invoice_statuses IS 'Invoice status options with automation triggers (future use)';
COMMENT ON COLUMN invoice_statuses.triggers_production IS 'When true, changing to this status auto-generates production tasks';

-- ============================================================================
-- 6. UPDATE EXISTING TASKS TABLE
-- ============================================================================
-- Add new columns to support production workflow system.
-- ============================================================================

-- Add line_item_id column (CRITICAL: links tasks to specific line items)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'line_item_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN line_item_id UUID;
    COMMENT ON COLUMN tasks.line_item_id IS 'Links task to specific line item (critical for multi-item invoices)';
  END IF;
END $$;

-- Add auto_generated flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'auto_generated'
  ) THEN
    ALTER TABLE tasks ADD COLUMN auto_generated BOOLEAN DEFAULT false NOT NULL;
    COMMENT ON COLUMN tasks.auto_generated IS 'True if task was created from a template, false if manually created';
  END IF;
END $$;

-- Add sort_order for ordering tasks within a line item
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0 NOT NULL;
    COMMENT ON COLUMN tasks.sort_order IS 'Order of task within the production workflow';
  END IF;
END $$;

-- Add template_task_key to reference the template task
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'template_task_key'
  ) THEN
    ALTER TABLE tasks ADD COLUMN template_task_key TEXT;
    COMMENT ON COLUMN tasks.template_task_key IS 'References template_tasks.task_key (e.g., VERIFY, PRINT, INSTALL)';
  END IF;
END $$;

-- Create indexes on new columns
CREATE INDEX IF NOT EXISTS idx_tasks_line_item
  ON tasks(line_item_id);
CREATE INDEX IF NOT EXISTS idx_tasks_auto_generated
  ON tasks(auto_generated) WHERE auto_generated = true;
CREATE INDEX IF NOT EXISTS idx_tasks_sort
  ON tasks(line_item_id, sort_order) WHERE line_item_id IS NOT NULL;

-- ============================================================================
-- 7. ADD FOREIGN KEY CONSTRAINTS
-- ============================================================================
-- Add foreign keys after all tables are created to avoid dependency issues.
-- ============================================================================

-- Link template_tasks to project_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_template_tasks_template'
  ) THEN
    ALTER TABLE template_tasks
      ADD CONSTRAINT fk_template_tasks_template
      FOREIGN KEY (template_key)
      REFERENCES project_templates(template_key)
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Link tasks to line_items (if line_items table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'line_items')
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_tasks_line_item'
    ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT fk_tasks_line_item
      FOREIGN KEY (line_item_id)
      REFERENCES line_items(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 8. ADD TEMPLATE REFERENCE TO CATEGORIES TABLE (Optional)
-- ============================================================================
-- Link categories to their default production templates.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories')
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'categories' AND column_name = 'template_key'
    ) THEN
    ALTER TABLE categories ADD COLUMN template_key TEXT;
    COMMENT ON COLUMN categories.template_key IS 'Default production template for this category';

    -- Add foreign key constraint
    ALTER TABLE categories
      ADD CONSTRAINT fk_categories_template
      FOREIGN KEY (template_key)
      REFERENCES project_templates(template_key)
      ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Next Steps:
-- 1. Run this migration against your Supabase database
-- 2. Proceed to Phase 1.2: Data Migration (migrate Google Sheets data)
-- 3. Proceed to Phase 1.3: Link categories to templates
--
-- ============================================================================
