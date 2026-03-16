-- Production Pipeline Configs table
-- Stores the two-track pipeline configuration per line item category.
-- Each row = one task in one track for one category.

CREATE TABLE IF NOT EXISTS production_pipeline_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_key TEXT NOT NULL,
  track TEXT NOT NULL CHECK (track IN ('prep', 'design', 'production')),
  track_label TEXT,
  task_key TEXT NOT NULL,
  task_label TEXT NOT NULL,
  task_icon TEXT DEFAULT '○',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_key, task_key)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_configs_category ON production_pipeline_configs(category_key);

-- Seed with current hardcoded pipeline data
-- FULL_WRAP
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('FULL_WRAP', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('FULL_WRAP', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('FULL_WRAP', 'prep', 'Materials', 'material_prepped', 'Material\nPrepped', '🗂', 3),
  ('FULL_WRAP', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('FULL_WRAP', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('FULL_WRAP', 'design', 'Design', 'file_prepped', 'File\nPrepped', '💾', 3),
  ('FULL_WRAP', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('FULL_WRAP', 'production', NULL, 'laminated', 'Laminated', '🔧', 2),
  ('FULL_WRAP', 'production', NULL, 'installed', 'Installed', '🚗', 3),
  ('FULL_WRAP', 'production', NULL, 'qc', 'QC', '🔍', 4)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- COMMERCIAL_WRAP (same as FULL_WRAP)
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('COMMERCIAL_WRAP', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('COMMERCIAL_WRAP', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('COMMERCIAL_WRAP', 'prep', 'Materials', 'material_prepped', 'Material\nPrepped', '🗂', 3),
  ('COMMERCIAL_WRAP', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('COMMERCIAL_WRAP', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('COMMERCIAL_WRAP', 'design', 'Design', 'file_prepped', 'File\nPrepped', '💾', 3),
  ('COMMERCIAL_WRAP', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('COMMERCIAL_WRAP', 'production', NULL, 'laminated', 'Laminated', '🔧', 2),
  ('COMMERCIAL_WRAP', 'production', NULL, 'installed', 'Installed', '🚗', 3),
  ('COMMERCIAL_WRAP', 'production', NULL, 'qc', 'QC', '🔍', 4)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- PARTIAL_WRAP
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('PARTIAL_WRAP', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('PARTIAL_WRAP', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('PARTIAL_WRAP', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('PARTIAL_WRAP', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('PARTIAL_WRAP', 'design', 'Design', 'file_prepped', 'File\nPrepped', '💾', 3),
  ('PARTIAL_WRAP', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('PARTIAL_WRAP', 'production', NULL, 'laminated', 'Laminated', '🔧', 2),
  ('PARTIAL_WRAP', 'production', NULL, 'installed', 'Installed', '🚗', 3),
  ('PARTIAL_WRAP', 'production', NULL, 'qc', 'QC', '🔍', 4)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- VINYL_WRAP
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('VINYL_WRAP', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('VINYL_WRAP', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('VINYL_WRAP', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('VINYL_WRAP', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('VINYL_WRAP', 'production', NULL, 'installed', 'Installed', '🚗', 1),
  ('VINYL_WRAP', 'production', NULL, 'qc', 'QC', '🔍', 2)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- PPF
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('PPF', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('PPF', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('PPF', 'design', 'Template', 'template_selected', 'Template\nSelected', '📐', 1),
  ('PPF', 'design', 'Template', 'film_cut', 'Film\nCut', '✂️', 2),
  ('PPF', 'production', NULL, 'installed', 'Installed', '🚗', 1),
  ('PPF', 'production', NULL, 'qc', 'QC', '🔍', 2)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- CHROME_DELETE
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('CHROME_DELETE', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('CHROME_DELETE', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('CHROME_DELETE', 'design', 'Prep', 'vehicle_prepped', 'Vehicle\nPrepped', '🚗', 1),
  ('CHROME_DELETE', 'production', NULL, 'installed', 'Installed', '🔧', 1),
  ('CHROME_DELETE', 'production', NULL, 'qc', 'QC', '🔍', 2)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- VINYL_LETTERING
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('VINYL_LETTERING', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('VINYL_LETTERING', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('VINYL_LETTERING', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('VINYL_LETTERING', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('VINYL_LETTERING', 'production', NULL, 'cut', 'Cut', '✂️', 1),
  ('VINYL_LETTERING', 'production', NULL, 'weeded', 'Weeded', '🧹', 2),
  ('VINYL_LETTERING', 'production', NULL, 'installed', 'Installed', '🚗', 3),
  ('VINYL_LETTERING', 'production', NULL, 'qc', 'QC', '🔍', 4)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- VINYL_GRAPHICS (same as VINYL_LETTERING)
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('VINYL_GRAPHICS', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('VINYL_GRAPHICS', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('VINYL_GRAPHICS', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('VINYL_GRAPHICS', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('VINYL_GRAPHICS', 'production', NULL, 'cut', 'Cut', '✂️', 1),
  ('VINYL_GRAPHICS', 'production', NULL, 'weeded', 'Weeded', '🧹', 2),
  ('VINYL_GRAPHICS', 'production', NULL, 'installed', 'Installed', '🚗', 3),
  ('VINYL_GRAPHICS', 'production', NULL, 'qc', 'QC', '🔍', 4)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- SIGNAGE
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('SIGNAGE', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('SIGNAGE', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('SIGNAGE', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('SIGNAGE', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('SIGNAGE', 'production', NULL, 'fabricated', 'Fabricated', '🔧', 1),
  ('SIGNAGE', 'production', NULL, 'installed', 'Installed', '📍', 2),
  ('SIGNAGE', 'production', NULL, 'qc', 'QC', '🔍', 3)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- CHANNEL_LETTERS (same as SIGNAGE)
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('CHANNEL_LETTERS', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('CHANNEL_LETTERS', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('CHANNEL_LETTERS', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('CHANNEL_LETTERS', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('CHANNEL_LETTERS', 'production', NULL, 'fabricated', 'Fabricated', '🔧', 1),
  ('CHANNEL_LETTERS', 'production', NULL, 'installed', 'Installed', '📍', 2),
  ('CHANNEL_LETTERS', 'production', NULL, 'qc', 'QC', '🔍', 3)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- BANNERS
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('BANNERS', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('BANNERS', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('BANNERS', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('BANNERS', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('BANNERS', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('BANNERS', 'production', NULL, 'finished', 'Finished', '🔧', 2),
  ('BANNERS', 'production', NULL, 'qc', 'QC', '🔍', 3)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- YARD_SIGNS
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('YARD_SIGNS', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('YARD_SIGNS', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('YARD_SIGNS', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('YARD_SIGNS', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('YARD_SIGNS', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('YARD_SIGNS', 'production', NULL, 'qc', 'QC', '🔍', 2)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- A_FRAMES (same as YARD_SIGNS)
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('A_FRAMES', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('A_FRAMES', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('A_FRAMES', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('A_FRAMES', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('A_FRAMES', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('A_FRAMES', 'production', NULL, 'qc', 'QC', '🔍', 2)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- STICKERS
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('STICKERS', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('STICKERS', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('STICKERS', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('STICKERS', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('STICKERS', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('STICKERS', 'production', NULL, 'cut', 'Cut', '✂️', 2),
  ('STICKERS', 'production', NULL, 'qc', 'QC', '🔍', 3)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- KISS_CUT_STICKERS (same as STICKERS)
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('KISS_CUT_STICKERS', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('KISS_CUT_STICKERS', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('KISS_CUT_STICKERS', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('KISS_CUT_STICKERS', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('KISS_CUT_STICKERS', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('KISS_CUT_STICKERS', 'production', NULL, 'cut', 'Cut', '✂️', 2),
  ('KISS_CUT_STICKERS', 'production', NULL, 'qc', 'QC', '🔍', 3)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- DIE_CUT_STICKERS (same as STICKERS)
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('DIE_CUT_STICKERS', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('DIE_CUT_STICKERS', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('DIE_CUT_STICKERS', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('DIE_CUT_STICKERS', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('DIE_CUT_STICKERS', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('DIE_CUT_STICKERS', 'production', NULL, 'cut', 'Cut', '✂️', 2),
  ('DIE_CUT_STICKERS', 'production', NULL, 'qc', 'QC', '🔍', 3)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- LABELS (same as STICKERS)
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('LABELS', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('LABELS', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('LABELS', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('LABELS', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('LABELS', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('LABELS', 'production', NULL, 'cut', 'Cut', '✂️', 2),
  ('LABELS', 'production', NULL, 'qc', 'QC', '🔍', 3)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- FOX_DECALS (same as STICKERS)
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('FOX_DECALS', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('FOX_DECALS', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('FOX_DECALS', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('FOX_DECALS', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('FOX_DECALS', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('FOX_DECALS', 'production', NULL, 'cut', 'Cut', '✂️', 2),
  ('FOX_DECALS', 'production', NULL, 'qc', 'QC', '🔍', 3)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- DESIGN_FEE
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('DESIGN_FEE', 'prep', 'Scope', 'scope_confirmed', 'Scope\nConfirmed', '📋', 1),
  ('DESIGN_FEE', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('DESIGN_FEE', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('DESIGN_FEE', 'production', NULL, 'files_sent', 'Files\nSent', '📧', 1)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- DESIGN (same as DESIGN_FEE)
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('DESIGN', 'prep', 'Scope', 'scope_confirmed', 'Scope\nConfirmed', '📋', 1),
  ('DESIGN', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('DESIGN', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('DESIGN', 'production', NULL, 'files_sent', 'Files\nSent', '📧', 1)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- ============================================================================
-- Sub-type pipeline entries (line_type keys)
-- These match sub-types under parent categories in the quote builder.
-- Categories with sub-types: VINYL_WRAP, VINYL_GRAPHICS, A_FRAME, YARD_SIGNS, SIGN_BOARDS, STICKERS
-- ============================================================================

-- VINYL_WRAP sub-types: COLOR_CHANGE_PARTIAL, COLOR_CHANGE_FULL
-- (FULL_WRAP and PARTIAL_WRAP already exist above)
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('COLOR_CHANGE_PARTIAL', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('COLOR_CHANGE_PARTIAL', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('COLOR_CHANGE_PARTIAL', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('COLOR_CHANGE_PARTIAL', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('COLOR_CHANGE_PARTIAL', 'design', 'Design', 'file_prepped', 'File\nPrepped', '💾', 3),
  ('COLOR_CHANGE_PARTIAL', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('COLOR_CHANGE_PARTIAL', 'production', NULL, 'laminated', 'Laminated', '🔧', 2),
  ('COLOR_CHANGE_PARTIAL', 'production', NULL, 'installed', 'Installed', '🚗', 3),
  ('COLOR_CHANGE_PARTIAL', 'production', NULL, 'qc', 'QC', '🔍', 4)
ON CONFLICT (category_key, task_key) DO NOTHING;

INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('COLOR_CHANGE_FULL', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('COLOR_CHANGE_FULL', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('COLOR_CHANGE_FULL', 'prep', 'Materials', 'material_prepped', 'Material\nPrepped', '🗂', 3),
  ('COLOR_CHANGE_FULL', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('COLOR_CHANGE_FULL', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('COLOR_CHANGE_FULL', 'design', 'Design', 'file_prepped', 'File\nPrepped', '💾', 3),
  ('COLOR_CHANGE_FULL', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('COLOR_CHANGE_FULL', 'production', NULL, 'laminated', 'Laminated', '🔧', 2),
  ('COLOR_CHANGE_FULL', 'production', NULL, 'installed', 'Installed', '🚗', 3),
  ('COLOR_CHANGE_FULL', 'production', NULL, 'qc', 'QC', '🔍', 4)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- VINYL_GRAPHICS sub-types
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('CUT_VINYL', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('CUT_VINYL', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('CUT_VINYL', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('CUT_VINYL', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('CUT_VINYL', 'production', NULL, 'cut', 'Cut', '✂️', 1),
  ('CUT_VINYL', 'production', NULL, 'weeded', 'Weeded', '🧹', 2),
  ('CUT_VINYL', 'production', NULL, 'installed', 'Installed', '🚗', 3),
  ('CUT_VINYL', 'production', NULL, 'qc', 'QC', '🔍', 4)
ON CONFLICT (category_key, task_key) DO NOTHING;

INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('VAN_INSERTS', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('VAN_INSERTS', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('VAN_INSERTS', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('VAN_INSERTS', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('VAN_INSERTS', 'production', NULL, 'cut', 'Cut', '✂️', 1),
  ('VAN_INSERTS', 'production', NULL, 'weeded', 'Weeded', '🧹', 2),
  ('VAN_INSERTS', 'production', NULL, 'installed', 'Installed', '🚗', 3),
  ('VAN_INSERTS', 'production', NULL, 'qc', 'QC', '🔍', 4)
ON CONFLICT (category_key, task_key) DO NOTHING;

INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('CAST_LET_GRAPH', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('CAST_LET_GRAPH', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('CAST_LET_GRAPH', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('CAST_LET_GRAPH', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('CAST_LET_GRAPH', 'production', NULL, 'cut', 'Cut', '✂️', 1),
  ('CAST_LET_GRAPH', 'production', NULL, 'weeded', 'Weeded', '🧹', 2),
  ('CAST_LET_GRAPH', 'production', NULL, 'installed', 'Installed', '🚗', 3),
  ('CAST_LET_GRAPH', 'production', NULL, 'qc', 'QC', '🔍', 4)
ON CONFLICT (category_key, task_key) DO NOTHING;

INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('CAST_GRAPH_BULK', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('CAST_GRAPH_BULK', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('CAST_GRAPH_BULK', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('CAST_GRAPH_BULK', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('CAST_GRAPH_BULK', 'production', NULL, 'cut', 'Cut', '✂️', 1),
  ('CAST_GRAPH_BULK', 'production', NULL, 'weeded', 'Weeded', '🧹', 2),
  ('CAST_GRAPH_BULK', 'production', NULL, 'installed', 'Installed', '🚗', 3),
  ('CAST_GRAPH_BULK', 'production', NULL, 'qc', 'QC', '🔍', 4)
ON CONFLICT (category_key, task_key) DO NOTHING;

INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('CAL_LET_GRAPH', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('CAL_LET_GRAPH', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('CAL_LET_GRAPH', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('CAL_LET_GRAPH', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('CAL_LET_GRAPH', 'production', NULL, 'cut', 'Cut', '✂️', 1),
  ('CAL_LET_GRAPH', 'production', NULL, 'weeded', 'Weeded', '🧹', 2),
  ('CAL_LET_GRAPH', 'production', NULL, 'installed', 'Installed', '🚗', 3),
  ('CAL_LET_GRAPH', 'production', NULL, 'qc', 'QC', '🔍', 4)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- STICKERS sub-types
INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('KISS_CUT', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('KISS_CUT', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('KISS_CUT', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('KISS_CUT', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('KISS_CUT', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('KISS_CUT', 'production', NULL, 'cut', 'Cut', '✂️', 2),
  ('KISS_CUT', 'production', NULL, 'qc', 'QC', '🔍', 3)
ON CONFLICT (category_key, task_key) DO NOTHING;

INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('DIE_CUT', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('DIE_CUT', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('DIE_CUT', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('DIE_CUT', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('DIE_CUT', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('DIE_CUT', 'production', NULL, 'cut', 'Cut', '✂️', 2),
  ('DIE_CUT', 'production', NULL, 'qc', 'QC', '🔍', 3)
ON CONFLICT (category_key, task_key) DO NOTHING;

INSERT INTO production_pipeline_configs (category_key, track, track_label, task_key, task_label, task_icon, sort_order) VALUES
  ('SHEET_LABELS', 'prep', 'Materials', 'material_ordered', 'Material\nOrdered', '📋', 1),
  ('SHEET_LABELS', 'prep', 'Materials', 'material_received', 'Material\nReceived', '📦', 2),
  ('SHEET_LABELS', 'design', 'Design', 'design_started', 'Design\nStarted', '🎨', 1),
  ('SHEET_LABELS', 'design', 'Design', 'design_approved', 'Design\nApproved', '✅', 2),
  ('SHEET_LABELS', 'production', NULL, 'printed', 'Printed', '🖨', 1),
  ('SHEET_LABELS', 'production', NULL, 'cut', 'Cut', '✂️', 2),
  ('SHEET_LABELS', 'production', NULL, 'qc', 'QC', '🔍', 3)
ON CONFLICT (category_key, task_key) DO NOTHING;

-- New categories WITHOUT default tasks (configured in Settings):
-- VINYL_FOX, WINDOW_PERF, MAGNETS, WALL_GRAPHICS, SIGN_BOARDS, BANNER_STAND
-- Sub-types: WITH_FRAME, INSERT_ONLY, VERTICAL_FLUTE, HORIZONTAL_FLUTE, CORO_PLAST, MAX_METAL, FOAM_CORE
