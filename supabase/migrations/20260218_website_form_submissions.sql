-- =============================================
--  WEBSITE FORM SUBMISSIONS
--  Adds columns to the existing submissions table
--  to support the commercial vehicle branding form.
--
--  Existing columns (customer_name, customer_email, etc.)
--  are reused where they map directly.
--  New columns handle multi-vehicle JSONB, coverage type,
--  artwork status, file uploads, and form metadata.
-- =============================================


-- ─── New columns on submissions table ───

-- Multi-vehicle support: array of vehicle objects
-- Each: { type, type_label, year, make, model, color, color_other,
--          conditionals: {}, browsing, is_other, other_desc, photo_urls: [] }
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS vehicles JSONB DEFAULT '[]'::jsonb;

-- Coverage type from form step 3
-- Values: full_wrap, partial_wrap, graphics_lettering, not_sure
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS coverage_type TEXT;

-- Artwork & design status from form step 4
-- Values: fleet_match, print_ready, logo_vision, logo_only, from_scratch, ai_mockup
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS artwork_status TEXT;

-- Whether the customer acknowledged the AI artwork policy
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_acknowledged BOOLEAN DEFAULT false;

-- Array of public URLs for uploaded logo files
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS logo_urls TEXT[] DEFAULT '{}';

-- Free-text "anything else" from form step 6
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS additional_info TEXT;

-- Which page the form was submitted from (e.g. /pages/wraps)
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS source_page TEXT;

-- Browser user-agent for debugging / analytics
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Budget as a dropdown value (form uses discrete ranges, not min/max)
-- Values: under_1000, 1000_2500, 2500_5000, 5000_10000, 10000_plus, not_sure
-- Coexists with the existing budget_range column used by the estimator
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS budget TEXT;


-- ─── Index for the new source field ───
-- Helps filter website form submissions vs estimator submissions
CREATE INDEX IF NOT EXISTS idx_submissions_source ON submissions(source);


-- =============================================
--  FILE STORAGE BUCKET
--  For vehicle photos and logo uploads from the form
-- =============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-uploads',
  'form-uploads',
  true,  -- public read so ops dashboard can view files
  10485760,  -- 10 MB max per file
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
    'application/pdf',
    'application/postscript',         -- .ai, .eps
    'image/svg+xml',                  -- .svg
    'application/illustrator'         -- .ai alternate
  ]
)
ON CONFLICT (id) DO NOTHING;


-- ─── Storage policies ───

-- Anyone can upload (form submissions from the public website)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'Allow form uploads'
  ) THEN
    CREATE POLICY "Allow form uploads"
      ON storage.objects
      FOR INSERT
      TO anon
      WITH CHECK (bucket_id = 'form-uploads');
  END IF;
END $$;

-- Anyone can read uploaded files (public bucket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'Allow form upload reads'
  ) THEN
    CREATE POLICY "Allow form upload reads"
      ON storage.objects
      FOR SELECT
      TO anon
      USING (bucket_id = 'form-uploads');
  END IF;
END $$;

-- Authenticated users (ops dashboard) can delete files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'Authenticated can delete form uploads'
  ) THEN
    CREATE POLICY "Authenticated can delete form uploads"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'form-uploads');
  END IF;
END $$;


-- =============================================
--  COMMENT: Field mapping reference
-- =============================================
--
--  Form field           →  Submissions column
--  ─────────────────────────────────────────────
--  business_name        →  company_name
--  contact_name         →  customer_name
--  email                →  customer_email
--  phone                →  customer_phone
--  contact_method       →  preferred_contact
--  vehicles[]           →  vehicles (JSONB)  ← NEW
--  coverage_type        →  coverage_type     ← NEW
--  artwork_status       →  artwork_status    ← NEW
--  ai_acknowledged      →  ai_acknowledged   ← NEW
--  logo_urls[]          →  logo_urls         ← NEW
--  timeline             →  timeline (existing)
--  budget               →  budget            ← NEW
--  additional_info      →  additional_info   ← NEW
--  source_page          →  source_page       ← NEW
--  user_agent           →  user_agent        ← NEW
--
--  source = 'website_form' distinguishes these
--  from estimator-created submissions.
-- =============================================
