-- Email Smart Buckets: thread cache + sync state
-- Run this in the Supabase SQL Editor

-- Thread cache with bucket assignment
CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_thread_id TEXT UNIQUE NOT NULL,

  -- Cached Gmail data
  subject TEXT NOT NULL DEFAULT '(no subject)',
  snippet TEXT DEFAULT '',
  message_count INTEGER DEFAULT 1,
  is_unread BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,

  -- Last message metadata
  last_message_from TEXT NOT NULL,
  last_message_date TIMESTAMPTZ NOT NULL,
  last_message_is_ours BOOLEAN NOT NULL DEFAULT false,

  -- For follow-up tier calculation: date of our FIRST unanswered reply
  -- Pinned once set; only reset when customer replies
  first_unanswered_reply_date TIMESTAMPTZ,

  -- All participants in thread
  participants TEXT[] DEFAULT '{}',

  -- Bucket assignment
  bucket TEXT NOT NULL DEFAULT 'need_to_respond'
    CHECK (bucket IN ('need_to_respond', 'responded', 'waiting_on_task', 'follow_up', 'archived')),
  follow_up_tier TEXT
    CHECK (follow_up_tier IS NULL OR follow_up_tier IN ('2_3_days', '6_8_days', '10_14_days', '1_3_months', '3_plus_months')),

  -- Manual flags
  waiting_on_task_flag BOOLEAN DEFAULT false,
  archived_flag BOOLEAN DEFAULT false,

  -- Gmail label IDs (cached)
  gmail_label_ids TEXT[] DEFAULT '{}',

  -- Sync metadata
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for fast bucket queries
CREATE INDEX idx_email_threads_bucket ON email_threads(bucket);
CREATE INDEX idx_email_threads_bucket_tier ON email_threads(bucket, follow_up_tier) WHERE bucket = 'follow_up';
CREATE INDEX idx_email_threads_last_message_date ON email_threads(last_message_date DESC);
CREATE INDEX idx_email_threads_unread ON email_threads(is_unread) WHERE is_unread = true;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_email_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_threads_updated_at
  BEFORE UPDATE ON email_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_email_threads_updated_at();

-- Singleton sync state table
CREATE TABLE IF NOT EXISTS email_sync_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gmail_history_id TEXT,
  last_full_sync_at TIMESTAMPTZ,
  last_incremental_sync_at TIMESTAMPTZ,
  sync_in_progress BOOLEAN DEFAULT false,
  sync_started_at TIMESTAMPTZ,
  total_threads_cached INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

INSERT INTO email_sync_state (id) VALUES (1) ON CONFLICT DO NOTHING;
