-- ============================================================================
-- FWG Ops - Fix Orphaned Production Template Links
-- Created: 2026-02-10
--
-- Links production templates to their categories that were missed
-- in the original import migration.
-- ============================================================================

-- These were missing from the original migration
UPDATE categories SET template_key = 'FULL_WRAP_WORKFLOW' WHERE category_key = 'FULL_WRAP' AND (template_key IS NULL OR template_key = '');
UPDATE categories SET template_key = 'PARTIAL_WRAP_WORKFLOW' WHERE category_key = 'PARTIAL_WRAP' AND (template_key IS NULL OR template_key = '');
UPDATE categories SET template_key = 'COLOR_CHANGE_WORKFLOW' WHERE category_key = 'COLOR_CHANGE' AND (template_key IS NULL OR template_key = '');
UPDATE categories SET template_key = 'LABELS_OH_WORKFLOW' WHERE category_key = 'LABELS_OH' AND (template_key IS NULL OR template_key = '');
UPDATE categories SET template_key = 'LABELS_OD_WORKFLOW' WHERE category_key = 'LABELS_OD' AND (template_key IS NULL OR template_key = '');

-- VINYL_LETTERING didn't have a production template - link to CUT_VINYL_WORKFLOW as closest match
UPDATE categories SET template_key = 'CUT_VINYL_WORKFLOW' WHERE category_key = 'VINYL_LETTERING' AND (template_key IS NULL OR template_key = '');

-- WINDOW_TINT, CHROME_DELETE, SIGNAGE, etc. don't have production templates yet.
-- They can be created from the UI and linked there.
