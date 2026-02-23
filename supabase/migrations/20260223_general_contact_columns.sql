-- ============================================================================
-- FWG Ops - General Contact Form Columns
-- Created: 2026-02-23
--
-- Adds columns for the general contact inquiry form
-- (form_type: general_contact). file_urls go into existing
-- service_details jsonb.
-- ============================================================================

-- Which service category they're interested in
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS service_interest TEXT;

-- Their message / inquiry
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS message TEXT;
