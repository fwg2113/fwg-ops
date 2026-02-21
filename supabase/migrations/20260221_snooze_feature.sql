-- Add snooze toggle to documents and submissions
-- Snoozed items are hidden from the action queue by default

ALTER TABLE documents ADD COLUMN IF NOT EXISTS snoozed BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS snoozed_at TIMESTAMPTZ;

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS snoozed BOOLEAN DEFAULT false;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS snoozed_at TIMESTAMPTZ;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_documents_snoozed ON documents(snoozed) WHERE snoozed = true;
CREATE INDEX IF NOT EXISTS idx_submissions_snoozed ON submissions(snoozed) WHERE snoozed = true;
