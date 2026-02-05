-- ============================================================================
-- Import Legacy Materials from Google Sheets
-- Imports all media, lamination, transfer tape, PPF, substrates, hardware, and DTF materials
-- ============================================================================

-- First, expand the materials table to support more fields from legacy system
DO $$
BEGIN
  -- Add new columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='material_type') THEN
    ALTER TABLE materials ADD COLUMN material_type TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='material_subtype') THEN
    ALTER TABLE materials ADD COLUMN material_subtype TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='finish') THEN
    ALTER TABLE materials ADD COLUMN finish TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='cost_sqft') THEN
    ALTER TABLE materials ADD COLUMN cost_sqft DECIMAL(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='width_ft') THEN
    ALTER TABLE materials ADD COLUMN width_ft DECIMAL(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='category_material_keys') THEN
    ALTER TABLE materials ADD COLUMN category_material_keys TEXT;
  END IF;
END $$;

-- Insert all materials (70 materials from legacy system)
-- Note: Using cost_per_unit for cost_sqft, markup is already in the multiplied form

-- MEDIA - Cast Vinyl
INSERT INTO materials (material_key, label, material_type, material_subtype, dropdown_field, cost_per_unit, cost_sqft, markup, width_ft, category_material_keys, active) VALUES
('ORACAL_3951RA_PLUS_PROSLIDE_54', 'Oracal 3951RA+ ProSlide 54"', 'MEDIA', 'CAST', 'media', 1.32, 1.32, 6.60, 4.5, 'FULL_WRAP|PARTIAL_WRAP', TRUE),
('AVERY_1105_54', 'Avery 1105 54"', 'MEDIA', 'CAST', 'media', 1.06, 1.06, 5.31, 4.5, 'FULL_WRAP|PARTIAL_WRAP|CAST_LET_GRAPH|CAST_GRAPH_BULK', TRUE),
('AVERY_1106_54', 'Avery 1106 54"', 'MEDIA', 'CAST', 'media', 1.21, 1.21, 6.05, 4.5, 'FULL_WRAP|PARTIAL_WRAP|CAST_LET_GRAPH|CAST_GRAPH_BULK|WALL_GRAPHICS', TRUE),
('AVERY_SW900_60', 'Avery SW900 60"', 'MEDIA', 'CAST', 'media', 1.80, 1.80, 9.02, 5.0, 'FULL_WRAP|PARTIAL_WRAP|COLOR_CHANGE_PARTIAL|COLOR_CHANGE_FULL|CHROME_DELETE', TRUE),
('3M_2080_60', '3M 2080 60"', 'MEDIA', 'CAST', 'media', 1.98, 1.98, 9.89, 5.0, 'FULL_WRAP|PARTIAL_WRAP|COLOR_CHANGE_PARTIAL|COLOR_CHANGE_FULL', TRUE),
('ORACAL_970RA_60', 'Oracal 970RA', 'MEDIA', 'CAST', 'media', 2.27, 2.27, 11.33, 5.0, 'FULL_WRAP|PARTIAL_WRAP|COLOR_CHANGE_PARTIAL|COLOR_CHANGE_FULL', TRUE),
('AVERY_2105_54', 'Avery 2105 54"', 'MEDIA', 'CAST', 'media', 0.62, 0.62, 3.12, 4.5, 'CAST_LET_GRAPH|CAST_GRAPH_BULK', TRUE),

-- MEDIA - Calendared Vinyl
('ORACAL_3551_G_54', 'Oracal 3551 Gloss 54"', 'MEDIA', 'CALENDARED', 'media', 0.64, 0.64, 3.18, 4.5, 'VAN_INSERTS|CAL_LET_GRAPH|KISS_CUT|DIE_CUT|SHEET_LABELS|CORO_PLAST|MAX_METAL|FOAM_CORE|SIGNAGE|SIGN_BOARDS|MAGNETS', TRUE),
('ORACAL_3551_C_54', 'Oracal 3551 Clear 54"', 'MEDIA', 'CALENDARED', 'media', 0.57, 0.57, 2.87, 4.5, 'CAL_LET_GRAPH|KISS_CUT|DIE_CUT|SHEET_LABELS|SIGNAGE', TRUE),
('BRITELINE_2203_30', 'Briteline 2203 30"', 'MEDIA', 'CALENDARED', 'media', 0.25, 0.25, 1.24, 2.5, 'KISS_CUT|DIE_CUT|SHEET_LABELS', TRUE),
('BRITELINE_2203_60', 'Briteline 2203 60"', 'MEDIA', 'CALENDARED', 'media', 0.25, 0.25, 1.24, 5.0, 'KISS_CUT|DIE_CUT|SHEET_LABELS', TRUE),
('BRITELINE_3205_54', 'Briteline 3205 Clear 54"', 'MEDIA', 'CALENDARED', 'media', 0.34, 0.34, 1.71, 4.5, 'KISS_CUT|DIE_CUT|SHEET_LABELS', TRUE),
('ORACAL_651_30', 'Oracal 651 30"', 'MEDIA', 'CALENDARED', 'media', 0.46, 0.46, 2.28, 2.5, 'SIGNAGE|SIGN_BOARDS', TRUE),
('BRITELINE_CARPET_FILM_IM3211', 'Briteline Carpet Film IM3211', 'MEDIA', 'CALENDARED', 'media', 0.50, 0.50, 2.51, 4.5, 'SIGNAGE', TRUE),
('BRITELINE_3223_6_MIL_54', 'Briteline 3223 6 Mil 54"', 'MEDIA', 'CALENDARED', 'media', 0.28, 0.28, 1.38, 4.5, '', TRUE),
('BRITELINE_HOLO_30', 'Briteline Holo 30"', 'MEDIA', 'CALENDARED', 'media', 2.32, 2.32, 11.59, 2.5, '', TRUE),

-- MEDIA - Specialty
('WINDOW_CLING_54', 'Window Cling 54"', 'MEDIA', 'WINDOW_CLING', 'media', 0.46, 0.46, 2.30, 4.5, '', TRUE),
('BRITELINE_5050_WINDOW_PERF_60', 'Briteline 50/50 Window Perf 60"', 'MEDIA', 'WINDOW_PERF', 'media', 0.84, 0.84, 4.22, 5.0, '', TRUE),
('RAD_GRAFIX_WALL_FILM_54', 'Rad Grafix Wall Film 54"', 'MEDIA', 'WALL', 'media', 0.46, 0.46, 2.31, 4.5, '', TRUE),
('13OZ_BANNER_63', 'Duratex 13oz Banner 63"', 'MEDIA', 'BANNER', 'media', 0.26, 0.26, 1.28, 5.25, '', TRUE),
('13OZ_BANNER_38', 'Duratex 13oz Banner 38"', 'MEDIA', 'BANNER', 'media', 0.26, 0.26, 1.28, 3.17, '', TRUE),
('BRITELINE_BAN_STAND_36', 'Briteline Roll Up Film BAN STAND 36"', 'MEDIA', 'BANNER', 'media', 0.68, 0.68, 3.40, 3.0, '', TRUE),

-- LAMINATION - Cast
('AVERY_DOL_1380Z_CAST_MATTE_54', 'Avery DOL 1380z Cast | Matte 54"', 'LAMINATION', 'CAST', 'lamination', 0.71, 0.71, 3.53, 4.5, 'FULL_WRAP|PARTIAL_WRAP|CAST_LET_GRAPH|CAST_GRAPH_BULK', TRUE),
('AVERY_DOL_1370Z_CAST_LUSTER_54', 'Avery DOL 1370z Cast | Luster 54"', 'LAMINATION', 'CAST', 'lamination', 0.70, 0.70, 3.52, 4.5, 'FULL_WRAP|PARTIAL_WRAP|CAST_LET_GRAPH|CAST_GRAPH_BULK', TRUE),
('AVERY_DOL_1360Z_CAST_GLOSS_54', 'Avery DOL 1360z Cast | Gloss 54"', 'LAMINATION', 'CAST', 'lamination', 0.74, 0.74, 3.71, 4.5, 'FULL_WRAP|PARTIAL_WRAP|CAST_LET_GRAPH|CAST_GRAPH_BULK', TRUE),

-- LAMINATION - Calendared
('ORAGUARD_215_G_54', 'OraGuard 215 Gloss 54"', 'LAMINATION', 'CALENDARED', 'lamination', 0.71, 0.71, 3.56, 4.5, 'VAN_INSERTS|CAL_LET_GRAPH|MAGNETS', TRUE),
('ORAGUARD_215_SG_54', 'OraGuard 215 Semi Gloss 54"', 'LAMINATION', 'CALENDARED', 'lamination', 0.76, 0.76, 3.79, 4.5, 'VAN_INSERTS|CAL_LET_GRAPH|MAGNETS', TRUE),

-- TRANSFER TAPE
('AIRMASK_510U_48', 'AirMask 510U 48"', 'TRANSFER_TAPE', 'CAST', 'transfer_tape', 0.20, 0.20, 1.01, 4.0, 'CAST_LET_GRAPH', TRUE),
('AIRMASK_510U_54', 'AirMask 510U 54"', 'TRANSFER_TAPE', 'CAST', 'transfer_tape', 0.20, 0.20, 1.01, 4.5, 'CAST_LET_GRAPH', TRUE),
('AIRMASK_510U_60', 'AirMask 510U 60"', 'TRANSFER_TAPE', 'CAST', 'transfer_tape', 0.20, 0.20, 1.01, 5.0, 'CAST_LET_GRAPH', TRUE),
('BRITELINE_TRANSFER_TAPE_30', 'Briteline Transfer Tape 30"', 'TRANSFER_TAPE', 'CALENDARED', 'transfer_tape', 0.19, 0.19, 0.93, 2.5, '', TRUE),
('BRITELINE_TRANSFER_TAPE_54', 'Briteline Transfer Tape 54"', 'TRANSFER_TAPE', 'CALENDARED', 'transfer_tape', 0.19, 0.19, 0.93, 4.5, 'CAL_LET_GRAPH', TRUE),
('BRITELINE_TRANSFER_TAPE_60', 'Briteline Transfer Tape 60"', 'TRANSFER_TAPE', 'CALENDARED', 'transfer_tape', 0.19, 0.19, 0.93, 5.0, '', TRUE),

-- PPF
('PPF_SOLARGARD_60', 'PPF - SolarGard 60"', 'PPF', NULL, 'media', 4.35, 4.35, 21.75, 5.0, 'PPF', TRUE),
('PPF_SOLARGARD_36', 'PPF - SolarGard 36"', 'PPF', NULL, 'media', 4.35, 4.35, 21.75, 3.0, 'PPF', TRUE),
('PPF_SOLARGARD_24', 'PPF - SolarGard 24"', 'PPF', NULL, 'media', 4.35, 4.35, 21.75, 2.0, 'PPF', TRUE),
('PPF_SUNTEK_60', 'PPF - Suntek 60"', 'PPF', NULL, 'media', 5.74, 5.74, 28.72, 5.0, 'PPF', TRUE),
('PPF_SUNTEK_36', 'PPF - Suntek 36"', 'PPF', NULL, 'media', 5.90, 5.90, 29.50, 3.0, 'PPF', TRUE),
('PPF_SUNTEK_30', 'PPF - Suntek 30"', 'PPF', NULL, 'media', 5.90, 5.90, 29.50, 2.5, 'PPF', TRUE),
('PPF_SUNTEK_24', 'PPF - Suntek 24"', 'PPF', NULL, 'media', 5.90, 5.90, 29.50, 2.0, 'PPF', TRUE),

-- SUBSTRATES
('FOAM_CORE_SHEET_4X8', 'Foam Core Sheet 4''x8''', 'SUBSTRATE', 'FOAM_CORE', 'substrate', 1.68, 1.68, 8.40, 4.0, 'FOAM_CORE|SIGNAGE|SIGN_BOARDS', TRUE),
('MAX_METAL_4X8', 'Max Metal Sheet 4''x8''', 'SUBSTRATE', 'MAX_METAL', 'substrate', 1.66, 1.66, 8.30, 4.0, 'MAX_METAL|SIGNAGE|SIGN_BOARDS', TRUE),
('CORO_PLASTIC_4X8', 'Corrugated Plastic Panel 4''x8''', 'SUBSTRATE', 'CORO_PLASTIC', 'substrate', 0.30, 0.30, 1.50, 4.0, 'CORO_PLAST|SIGNAGE|SIGN_BOARDS|VERTICAL_FLUTE|HORIZONTAL_FLUTE', TRUE),
('CORO_PLASTIC_5X10', 'Corrugated Plastic Panel 5''x10''', 'SUBSTRATE', 'CORO_PLASTIC', 'substrate', 0.30, 0.30, 1.50, 4.0, 'CORO_PLAST|SIGNAGE|SIGN_BOARDS|VERTICAL_FLUTE|HORIZONTAL_FLUTE', TRUE),
('MAGNUM_MAGNETICS_48', 'Magnum Magnetics DigiMaxx 48"', 'SUBSTRATE', 'MAGNET', 'substrate', 1.77, 1.77, 8.84, 4.0, 'SIGNAGE|SIGN_BOARDS|MAGNETS', TRUE),
('MAGNUM_MAGNETICS_30', 'Magnum Magnetics DigiMag 30"', 'SUBSTRATE', 'MAGNET', 'substrate', 2.94, 2.94, 14.68, 2.5, 'SIGNAGE|SIGN_BOARDS|MAGNETS', TRUE),
('YARD_SIGN_BLANK_VERTICAL', 'Yard Sign Blank 18"x24"', 'SUBSTRATE', 'YARD_SIGN', 'substrate', 0.33, 0.33, 1.67, 1.5, 'SIGNAGE|SIGN_BOARDS|VERTICAL_FLUTE', TRUE),
('YARD_SIGN_BLANK_HORIZONTAL', 'Yard Sign Blank 24"x18"', 'SUBSTRATE', 'YARD_SIGN', 'substrate', 30.23, 30.23, 151.17, 2.0, 'SIGNAGE|SIGN_BOARDS|HORIZONTAL_FLUTE', TRUE),
('A_FRAME_BLANK', 'A-Frame Blank 24"x36"', 'SUBSTRATE', 'A_FRAME', 'substrate', 0.36, 0.36, 1.82, 2.0, 'SIGNAGE|SIGN_BOARDS|WITH_FRAME|INSERT_ONLY|VERTICAL_FLUTE', TRUE),

-- HARDWARE
('BANNER_STAND_36', 'Banner Stand 36"', 'HARDWARE', 'BANNER', 'hardware', 38.13, 38.13, 190.65, 0, 'BANNER_STAND', TRUE),
('A_FRAME_BLACK', 'Plasticade A-Frame Black', 'HARDWARE', 'A_FRAME', 'hardware', 72.00, 72.00, 360.00, 0, 'WITH_FRAME', TRUE),
('A_FRAME_WHITE', 'Plasticade A-Frame White', 'HARDWARE', 'A_FRAME', 'hardware', 72.00, 72.00, 360.00, 0, 'WITH_FRAME', TRUE),

-- DTF APPAREL
('DTF_INK_PER_CC', 'DTF Ink per CC', 'APPAREL', 'DTF', '', 0.13, 0.13, 0.65, 0, 'TRANSFER_BY_SIZE|GANG_SHEET', TRUE),
('DTF_POWDER', 'DTF Powder', 'APPAREL', 'DTF', '', 0.04, 0.04, 0.22, 0, 'TRANSFER_BY_SIZE|GANG_SHEET', TRUE),
('DTF_TRANSFER_24_INCH', 'DTF Transfer 24 inch', 'APPAREL', 'DTF', 'dtf', 0.18, 0.18, 0.88, 2.0, 'TRANSFER_BY_SIZE|GANG_SHEET', TRUE),
('DTF_TRANSFER_30_INCH', 'DTF Transfer 30 Inch', 'APPAREL', 'DTF', 'dtf', 0.02, 0.02, 0.10, 30.0, 'TRANSFER_BY_SIZE|GANG_SHEET', TRUE),
('MIMAKI_DTF_POWDER', 'Mimaki DTF Powder', 'APPAREL', 'DTF', '', 0.02, 0.02, 0.11, 0, 'TRANSFER_BY_SIZE|GANG_SHEET', TRUE)

ON CONFLICT (material_key) DO UPDATE SET
  label = EXCLUDED.label,
  material_type = EXCLUDED.material_type,
  material_subtype = EXCLUDED.material_subtype,
  dropdown_field = EXCLUDED.dropdown_field,
  cost_per_unit = EXCLUDED.cost_per_unit,
  cost_sqft = EXCLUDED.cost_sqft,
  markup = EXCLUDED.markup,
  width_ft = EXCLUDED.width_ft,
  category_material_keys = EXCLUDED.category_material_keys,
  active = EXCLUDED.active;

COMMENT ON TABLE materials IS 'Materials catalog imported from legacy Google Sheets system';
