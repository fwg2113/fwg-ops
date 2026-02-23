-- ============================================================================
-- FWG Ops - Signage & Promotional Print Form Columns
-- Created: 2026-02-23
--
-- Adds signage-specific columns to the submissions table for the
-- Signage & Promotional Print inquiry form (form_type: signage_promo).
--
-- quantity, size, notes, and design_file_urls go into existing
-- service_details jsonb. timeline already exists.
-- ============================================================================

-- Array of selected signage type keys (e.g. yard_signs, pvc_banners)
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS signage_types JSONB DEFAULT '[]'::jsonb;
