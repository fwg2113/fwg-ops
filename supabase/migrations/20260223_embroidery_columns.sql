-- ============================================================================
-- FWG Ops - Custom Embroidery Form Columns
-- Created: 2026-02-23
--
-- Adds embroidery-specific columns to the submissions table for the
-- Custom Embroidery inquiry form (form_type: embroidery).
--
-- sourcing_notes, notes, and design_file_urls go into existing
-- service_details jsonb. timeline already exists.
-- ============================================================================

-- Array of per-product objects with placements and quantities
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS embroidery_items JSONB DEFAULT '[]'::jsonb;

-- How garments are supplied: customer_supplies, fwg_sources, not_sure
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS garment_supply TEXT;

-- Design size: small, medium, large, oversized, not_sure
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS design_size TEXT;

-- Digitizing status: have_file, needs_digitizing, not_sure
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS digitizing TEXT;
