-- Dev Requests table for internal team bug/feature reporting
CREATE TABLE IF NOT EXISTS dev_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  request_type TEXT NOT NULL DEFAULT 'bug',  -- bug, feature, improvement, question
  priority TEXT NOT NULL DEFAULT 'medium',   -- critical, high, medium, low
  status TEXT NOT NULL DEFAULT 'open',       -- open, in_progress, resolved, closed

  -- Guided fields (the what/where/when/why)
  where_in_app TEXT,           -- Which page/section of the app
  what_happened TEXT,          -- Description of issue or request
  steps_to_reproduce TEXT,     -- How to reproduce (for bugs)
  expected_behavior TEXT,      -- What should happen
  actual_behavior TEXT,        -- What actually happens (for bugs)
  why_needed TEXT,             -- Business reason / impact

  -- Meta
  submitted_by TEXT NOT NULL DEFAULT 'Team',
  screenshot_url TEXT,
  dev_notes TEXT,              -- Notes from the developer
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_dev_requests_status ON dev_requests(status);
CREATE INDEX IF NOT EXISTS idx_dev_requests_priority ON dev_requests(priority);
CREATE INDEX IF NOT EXISTS idx_dev_requests_created ON dev_requests(created_at DESC);
