-- Add production_stage column to documents for kanban board tracking
-- Values: QUEUE, DESIGN, PRINT, PRODUCTION, QC, COMPLETE
ALTER TABLE documents ADD COLUMN IF NOT EXISTS production_stage TEXT DEFAULT 'QUEUE';

-- Set existing in-production documents to QUEUE so they appear on the board
UPDATE documents
SET production_stage = 'QUEUE'
WHERE in_production = true
  AND (production_stage IS NULL OR production_stage = 'QUEUE')
  AND status NOT IN ('completed', 'shipped', 'picked_up');

-- Set completed documents
UPDATE documents
SET production_stage = 'COMPLETE'
WHERE status IN ('completed', 'shipped', 'picked_up')
  AND in_production = true;

-- Index for filtering by stage
CREATE INDEX IF NOT EXISTS idx_documents_production_stage ON documents (production_stage)
WHERE in_production = true;
