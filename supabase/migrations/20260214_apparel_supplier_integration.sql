-- ============================================================================
-- FWG Ops - Apparel Supplier Integration (SS Activewear + SanMar)
-- Created: 2026-02-14
-- Phase: 1.0 - Database Foundation
-- ============================================================================
--
-- This migration extends the system to support apparel supplier integrations:
-- 1. Extends line_items table with supplier-specific fields
-- 2. Creates apparel_pricing_matrices table for decoration pricing
-- 3. Inserts pricing matrices (Polo Embroidery, Cap Embroidery, DTF)
--
-- ============================================================================

-- ============================================================================
-- 1. EXTEND LINE_ITEMS TABLE
-- ============================================================================
-- Add supplier integration fields to support product catalog lookups,
-- decoration configurations, and automated pricing calculations.
-- ============================================================================

ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS supplier TEXT,
  ADD COLUMN IF NOT EXISTS supplier_style_id TEXT,
  ADD COLUMN IF NOT EXISTS style_number TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS product_image_url TEXT,
  ADD COLUMN IF NOT EXISTS decoration_type TEXT,
  ADD COLUMN IF NOT EXISTS decoration_locations JSONB,
  ADD COLUMN IF NOT EXISTS stitch_count TEXT,
  ADD COLUMN IF NOT EXISTS sizes_data JSONB,
  ADD COLUMN IF NOT EXISTS wholesale_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS markup_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS include_digitizing BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS digitizing_fee NUMERIC(10,2) DEFAULT 35.00,
  ADD COLUMN IF NOT EXISTS price_override NUMERIC(10,2);

-- Add indexes for supplier lookups
CREATE INDEX IF NOT EXISTS idx_line_items_supplier
  ON line_items(supplier) WHERE supplier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_line_items_supplier_style
  ON line_items(supplier, supplier_style_id) WHERE supplier IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN line_items.supplier IS 'Supplier source: ss_activewear, sanmar, null for manual entry';
COMMENT ON COLUMN line_items.supplier_style_id IS 'Supplier-specific product ID (e.g., SS Activewear style ID)';
COMMENT ON COLUMN line_items.style_number IS 'Human-readable style number (e.g., ST350, PC54)';
COMMENT ON COLUMN line_items.decoration_type IS 'Decoration method: embroidery, dtf, screen_print';
COMMENT ON COLUMN line_items.decoration_locations IS 'Array of decoration locations: ["front", "back", "left_sleeve", "right_sleeve", "extra"]';
COMMENT ON COLUMN line_items.stitch_count IS 'Stitch count tier for embroidery: up_to_10k, 10k_to_20k, 20k_plus';
COMMENT ON COLUMN line_items.sizes_data IS 'Size breakdown: [{size: "M", qty: 5, wholesale: 8.50, price: 25.00, upcharge: 0}]';
COMMENT ON COLUMN line_items.wholesale_cost IS 'Average wholesale cost per item (calculated from sizes_data)';
COMMENT ON COLUMN line_items.markup_percent IS 'Markup percentage applied to wholesale cost';
COMMENT ON COLUMN line_items.price_override IS 'Manual price override per item (overrides calculated pricing)';

-- ============================================================================
-- 2. APPAREL PRICING MATRICES TABLE
-- ============================================================================
-- Stores pricing matrices for different decoration types (embroidery, DTF).
-- quantity_breaks JSONB structure:
-- [
--   {
--     "min": 1,
--     "max": 5,
--     "markup_pct": 200,
--     "decoration_prices": {
--       "up_to_10k": 18.00,      // For embroidery
--       "10k_to_20k": 30.00,     // For embroidery
--       "front": 5.00,           // For DTF
--       "back": 5.00,            // For DTF
--       "left_sleeve": 5.00,     // For DTF
--       "right_sleeve": 5.00,    // For DTF
--       "extra": 5.00            // For DTF
--     }
--   }
-- ]
-- ============================================================================

CREATE TABLE IF NOT EXISTS apparel_pricing_matrices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  decoration_type TEXT NOT NULL CHECK (decoration_type IN ('embroidery', 'dtf', 'screen_print')),
  applies_to TEXT[] NOT NULL,
  quantity_breaks JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_apparel_pricing_decoration_type
  ON apparel_pricing_matrices(decoration_type);

-- Add updated_at trigger
CREATE TRIGGER update_apparel_pricing_matrices_updated_at
  BEFORE UPDATE ON apparel_pricing_matrices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE apparel_pricing_matrices IS 'Pricing matrices for apparel decoration (embroidery, DTF, screen printing)';
COMMENT ON COLUMN apparel_pricing_matrices.applies_to IS 'Category keys this matrix applies to: [EMBROIDERED_POLOS, EMBROIDERED_CAPS, APPAREL]';
COMMENT ON COLUMN apparel_pricing_matrices.quantity_breaks IS 'Quantity break tiers with markup % and decoration prices per location/stitch count';

-- ============================================================================
-- 3. INSERT PRICING MATRICES
-- ============================================================================
-- Polo/Shirt Embroidery Matrix
-- Cap Embroidery Matrix
-- DTF Apparel Matrix
-- ============================================================================

-- Polo/Shirt Embroidery Pricing
INSERT INTO apparel_pricing_matrices (name, decoration_type, applies_to, quantity_breaks)
VALUES (
  'Polo/Shirt Embroidery',
  'embroidery',
  ARRAY['EMBROIDERED_POLOS', 'APPAREL']::TEXT[],
  '[
    {"min": 1,    "max": 1,    "markup_pct": 200, "decoration_prices": {"up_to_10k": 18.00, "10k_to_20k": 30.00}},
    {"min": 2,    "max": 5,    "markup_pct": 200, "decoration_prices": {"up_to_10k": 15.00, "10k_to_20k": 25.00}},
    {"min": 6,    "max": 11,   "markup_pct": 200, "decoration_prices": {"up_to_10k": 12.00, "10k_to_20k": 19.00}},
    {"min": 12,   "max": 24,   "markup_pct": 200, "decoration_prices": {"up_to_10k": 11.00, "10k_to_20k": 18.00}},
    {"min": 25,   "max": 49,   "markup_pct": 200, "decoration_prices": {"up_to_10k": 10.50, "10k_to_20k": 17.00}},
    {"min": 50,   "max": 99,   "markup_pct": 200, "decoration_prices": {"up_to_10k": 10.00, "10k_to_20k": 16.00}},
    {"min": 100,  "max": 249,  "markup_pct": 200, "decoration_prices": {"up_to_10k": 9.00,  "10k_to_20k": 15.00}},
    {"min": 250,  "max": 499,  "markup_pct": 200, "decoration_prices": {"up_to_10k": 8.50,  "10k_to_20k": 14.00}},
    {"min": 500,  "max": 999,  "markup_pct": 200, "decoration_prices": {"up_to_10k": 8.00,  "10k_to_20k": 12.00}},
    {"min": 1000, "max": 99999, "markup_pct": 200, "decoration_prices": {"up_to_10k": 7.50,  "10k_to_20k": 10.00}}
  ]'::JSONB
);

-- Cap Embroidery Pricing
INSERT INTO apparel_pricing_matrices (name, decoration_type, applies_to, quantity_breaks)
VALUES (
  'Cap Embroidery',
  'embroidery',
  ARRAY['EMBROIDERED_CAPS']::TEXT[],
  '[
    {"min": 1,    "max": 1,    "markup_pct": 200, "decoration_prices": {"up_to_10k": 18.00, "10k_to_20k": 30.00}},
    {"min": 2,    "max": 5,    "markup_pct": 200, "decoration_prices": {"up_to_10k": 17.00, "10k_to_20k": 25.00}},
    {"min": 6,    "max": 11,   "markup_pct": 200, "decoration_prices": {"up_to_10k": 14.00, "10k_to_20k": 24.00}},
    {"min": 12,   "max": 24,   "markup_pct": 200, "decoration_prices": {"up_to_10k": 13.00, "10k_to_20k": 23.00}},
    {"min": 25,   "max": 49,   "markup_pct": 200, "decoration_prices": {"up_to_10k": 12.50, "10k_to_20k": 22.00}},
    {"min": 50,   "max": 99,   "markup_pct": 200, "decoration_prices": {"up_to_10k": 12.00, "10k_to_20k": 21.00}},
    {"min": 100,  "max": 249,  "markup_pct": 200, "decoration_prices": {"up_to_10k": 11.00, "10k_to_20k": 20.00}},
    {"min": 250,  "max": 499,  "markup_pct": 200, "decoration_prices": {"up_to_10k": 10.50, "10k_to_20k": 19.00}},
    {"min": 500,  "max": 999,  "markup_pct": 200, "decoration_prices": {"up_to_10k": 10.00, "10k_to_20k": 18.00}},
    {"min": 1000, "max": 99999, "markup_pct": 200, "decoration_prices": {"up_to_10k": 9.50,  "10k_to_20k": 17.00}}
  ]'::JSONB
);

-- DTF Apparel Pricing (flat $5 per location)
INSERT INTO apparel_pricing_matrices (name, decoration_type, applies_to, quantity_breaks)
VALUES (
  'DTF Apparel',
  'dtf',
  ARRAY['APPAREL', 'DTF_TRANSFER']::TEXT[],
  '[
    {"min": 1,   "max": 1,   "markup_pct": 350, "decoration_prices": {"front": 5.00, "back": 5.00, "left_sleeve": 5.00, "right_sleeve": 5.00, "extra": 5.00}},
    {"min": 2,   "max": 23,  "markup_pct": 225, "decoration_prices": {"front": 5.00, "back": 5.00, "left_sleeve": 5.00, "right_sleeve": 5.00, "extra": 5.00}},
    {"min": 24,  "max": 48,  "markup_pct": 185, "decoration_prices": {"front": 5.00, "back": 5.00, "left_sleeve": 5.00, "right_sleeve": 5.00, "extra": 5.00}},
    {"min": 49,  "max": 98,  "markup_pct": 175, "decoration_prices": {"front": 5.00, "back": 5.00, "left_sleeve": 5.00, "right_sleeve": 5.00, "extra": 5.00}},
    {"min": 99,  "max": 248, "markup_pct": 160, "decoration_prices": {"front": 5.00, "back": 5.00, "left_sleeve": 5.00, "right_sleeve": 5.00, "extra": 5.00}},
    {"min": 249, "max": 498, "markup_pct": 150, "decoration_prices": {"front": 5.00, "back": 5.00, "left_sleeve": 5.00, "right_sleeve": 5.00, "extra": 5.00}},
    {"min": 499, "max": 99999, "markup_pct": 125, "decoration_prices": {"front": 5.00, "back": 5.00, "left_sleeve": 5.00, "right_sleeve": 5.00, "extra": 5.00}}
  ]'::JSONB
);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
