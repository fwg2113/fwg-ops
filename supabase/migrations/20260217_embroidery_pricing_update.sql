-- Update embroidery pricing to unified matrix
-- Replaces the two separate polo/cap matrices with one unified embroidery matrix

-- Delete existing embroidery matrices
DELETE FROM apparel_pricing_matrices WHERE decoration_type = 'embroidery';

-- Insert unified embroidery pricing matrix
INSERT INTO apparel_pricing_matrices (name, decoration_type, applies_to, quantity_breaks)
VALUES (
  'Embroidery',
  'embroidery',
  ARRAY['EMBROIDERED_POLOS', 'EMBROIDERED_CAPS', 'APPAREL']::TEXT[],
  '[
    {"min": 1,   "max": 1,     "markup_pct": 350, "decoration_prices": {"up_to_10k": 8.00, "10k_to_20k": 15.00}},
    {"min": 2,   "max": 23,    "markup_pct": 225, "decoration_prices": {"up_to_10k": 8.00, "10k_to_20k": 15.00}},
    {"min": 24,  "max": 48,    "markup_pct": 185, "decoration_prices": {"up_to_10k": 7.00, "10k_to_20k": 12.00}},
    {"min": 49,  "max": 99,    "markup_pct": 175, "decoration_prices": {"up_to_10k": 6.50, "10k_to_20k": 11.00}},
    {"min": 100, "max": 249,   "markup_pct": 160, "decoration_prices": {"up_to_10k": 5.50, "10k_to_20k": 9.00}},
    {"min": 250, "max": 499,   "markup_pct": 150, "decoration_prices": {"up_to_10k": 5.00, "10k_to_20k": 8.00}},
    {"min": 500, "max": 99999, "markup_pct": 125, "decoration_prices": {"up_to_10k": 4.50, "10k_to_20k": 7.00}}
  ]'::JSONB
);
