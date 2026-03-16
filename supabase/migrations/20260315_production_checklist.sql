-- Add production_checklist JSONB column to line_items
-- Used by the new FWG Production page for per-line-item task tracking.
-- Each key is a task_key, value is { "done": bool, "at": timestamp }

ALTER TABLE line_items ADD COLUMN IF NOT EXISTS production_checklist JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_line_items_production_checklist ON line_items USING GIN (production_checklist);
