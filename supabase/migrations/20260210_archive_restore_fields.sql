-- ============================================================================
-- FWG Ops - Archive Restore Fields Migration
-- Created: 2026-02-10
--
-- Stores pre-archive state so documents and submissions can be restored
-- to their exact previous status when un-archived.
-- ============================================================================

-- Documents: remember status and bucket before archiving
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pre_archive_status TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pre_archive_bucket TEXT;

-- Submissions: remember status before archiving
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS pre_archive_status TEXT;
