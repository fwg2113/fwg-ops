-- Add pricing snapshot columns to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pricing_snapshot_json JSONB DEFAULT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pricing_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pricing_snapshot_at TIMESTAMPTZ DEFAULT NULL;

-- Create table for send snapshots (full document state at time of send)
CREATE TABLE IF NOT EXISTS document_send_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL,
  sent_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by document
CREATE INDEX IF NOT EXISTS idx_send_snapshots_document_id ON document_send_snapshots(document_id);
CREATE INDEX IF NOT EXISTS idx_send_snapshots_created_at ON document_send_snapshots(created_at DESC);
