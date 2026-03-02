-- =============================================
--  AD ATTRIBUTION TRACKING
--  Adds Google Ads click IDs, UTM parameters,
--  and first-touch landing context to submissions
--  so we can later upload offline conversions.
--
--  Existing columns reused:
--    user_agent  (added in 20260218)
--    source_page (added in 20260218) — page the form is on
--
--  New columns below capture first-touch ad context:
--    landing_page — first URL visited from the ad
--    referrer     — document.referrer on first visit
-- =============================================


-- ─── Google Ads click identifiers ───

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS gclid TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS gbraid TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS wbraid TEXT;


-- ─── UTM parameters ───

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS utm_term TEXT;


-- ─── First-touch context ───

-- The full URL of the first page visit (distinct from source_page which
-- records which page the form itself is embedded on).
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS landing_page TEXT;

-- The document.referrer captured on first page load.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS referrer TEXT;


-- ─── Index for gclid lookups ───
-- Useful when matching offline conversions back to click IDs.

CREATE INDEX IF NOT EXISTS idx_submissions_gclid ON submissions(gclid)
  WHERE gclid IS NOT NULL;
