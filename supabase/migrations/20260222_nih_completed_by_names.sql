-- Add completed_by_names to store all completers (comma-separated)
-- completed_by (UUID FK) stays as primary completer, this stores the full list as text
ALTER TABLE nih_tasks ADD COLUMN IF NOT EXISTS completed_by_names TEXT;
