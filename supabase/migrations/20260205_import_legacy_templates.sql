-- ============================================================================
-- Import Legacy Production Templates and Tasks
-- This migration imports all workflows from the legacy Google Sheets system
-- ============================================================================

-- Insert all production templates
INSERT INTO project_templates (template_key, category_key, label, description, active, sort_order) VALUES
  ('FULL_WRAP_WORKFLOW', 'FULL_WRAP', 'Full Wrap Workflow', 'Complete process for full vehicle wraps', TRUE, 1),
  ('PARTIAL_WRAP_WORKFLOW', 'PARTIAL_WRAP', 'Partial Wrap Workflow', 'Process for partial wraps and accents', TRUE, 2),
  ('PPF_WORKFLOW', 'PPF', 'PPF Installation Workflow', 'Paint protection film installation process', TRUE, 3),
  ('COLOR_CHANGE_WORKFLOW', 'COLOR_CHANGE', 'Color Change Workflow', 'Full color change wrap process', TRUE, 4),
  ('STICKERS', 'STICKERS', 'Stickers', 'Stickers production workflow', TRUE, 5),
  ('EMBROIDERY', 'EMBROIDERY', 'Embroidery', 'Embroidery production workflow', TRUE, 6),
  ('LABELS_OH_WORKFLOW', 'LABELS_OH', 'Labels On Hand', 'Labels on hand production workflow', TRUE, 8),
  ('LABELS_OD_WORKFLOW', 'LABELS_OD', 'Labels On Demand', 'Labels on demand production workflow', TRUE, 9),
  ('CAST_LET_GRAPH_WORKFLOW', 'VINYL_GRAPHICS', 'Cast Lettering Graphics', 'Cast vinyl lettering and graphics workflow', TRUE, 10),
  ('CAL_LET_GRAPH_WORKFLOW', 'VINYL_GRAPHICS', 'Calendared Lettering Graphics', 'Calendared vinyl lettering and graphics workflow', TRUE, 11),
  ('CAST_GRAPH_BULK_WORKFLOW', 'VINYL_GRAPHICS', 'Cast Graphics Bulk', 'Bulk cast vinyl graphics workflow', TRUE, 12),
  ('VAN_INSERTS_WORKFLOW', 'VINYL_GRAPHICS', 'Van Inserts', 'Commercial van inserts workflow', TRUE, 13),
  ('CUT_VINYL_WORKFLOW', 'VINYL_GRAPHICS', 'Cut Vinyl', 'Cut vinyl workflow', TRUE, 14)
ON CONFLICT (template_key) DO NOTHING;

-- Insert all template tasks
INSERT INTO template_tasks (template_key, task_key, label, default_priority, sort_order, active) VALUES
  -- FULL_WRAP_WORKFLOW
  ('FULL_WRAP_WORKFLOW', 'VERIFY_MEASUREMENTS', 'Verify Measurements', 'MEDIUM', 1, TRUE),
  ('FULL_WRAP_WORKFLOW', 'FINALIZE_DESIGN', 'Finalize Artwork/Design', 'HIGH', 2, TRUE),
  ('FULL_WRAP_WORKFLOW', 'PRINT', 'Print Wrap', 'MEDIUM', 3, TRUE),
  ('FULL_WRAP_WORKFLOW', 'OUTGAS', 'Outgas (overnight minimum)', 'LOW', 4, TRUE),
  ('FULL_WRAP_WORKFLOW', 'LAMINATE', 'Laminate', 'MEDIUM', 5, TRUE),
  ('FULL_WRAP_WORKFLOW', 'CUTDOWN', 'Cutdown', 'MEDIUM', 6, TRUE),
  ('FULL_WRAP_WORKFLOW', 'PREP_VEHICLE', 'Prep Vehicle', 'HIGH', 7, TRUE),
  ('FULL_WRAP_WORKFLOW', 'INSTALL', 'Install Wrap', 'HIGH', 8, TRUE),
  ('FULL_WRAP_WORKFLOW', 'QUALITY_CHECK', 'Quality Check', 'HIGH', 9, TRUE),
  ('FULL_WRAP_WORKFLOW', 'CUSTOMER_PICKUP', 'Customer Pickup', 'MEDIUM', 10, TRUE),

  -- PARTIAL_WRAP_WORKFLOW
  ('PARTIAL_WRAP_WORKFLOW', 'VERIFY_MEASUREMENTS', 'Verify Measurements', 'MEDIUM', 1, TRUE),
  ('PARTIAL_WRAP_WORKFLOW', 'FINALIZE_DESIGN', 'Finalize Artwork/Design', 'HIGH', 2, TRUE),
  ('PARTIAL_WRAP_WORKFLOW', 'PRINT', 'Print Wrap', 'MEDIUM', 3, TRUE),
  ('PARTIAL_WRAP_WORKFLOW', 'OUTGAS', 'Outgas', 'LOW', 4, TRUE),
  ('PARTIAL_WRAP_WORKFLOW', 'LAMINATE', 'Laminate', 'MEDIUM', 5, TRUE),
  ('PARTIAL_WRAP_WORKFLOW', 'PREP_VEHICLE', 'Prep Vehicle', 'MEDIUM', 6, TRUE),
  ('PARTIAL_WRAP_WORKFLOW', 'INSTALL', 'Install Wrap', 'HIGH', 7, TRUE),
  ('PARTIAL_WRAP_WORKFLOW', 'QUALITY_CHECK', 'Quality Check', 'HIGH', 8, TRUE),

  -- PPF_WORKFLOW
  ('PPF_WORKFLOW', 'PREP_VEHICLE', 'Prep Vehicle / Wash', 'HIGH', 1, TRUE),
  ('PPF_WORKFLOW', 'CUT_FILM', 'Cut PPF Film', 'MEDIUM', 2, TRUE),
  ('PPF_WORKFLOW', 'INSTALL_PPF', 'Install PPF', 'HIGH', 3, TRUE),
  ('PPF_WORKFLOW', 'QUALITY_CHECK', 'Quality Check', 'HIGH', 4, TRUE),
  ('PPF_WORKFLOW', 'CUSTOMER_PICKUP', 'Customer Pickup', 'MEDIUM', 5, TRUE),

  -- COLOR_CHANGE_WORKFLOW
  ('COLOR_CHANGE_WORKFLOW', 'VERIFY_MEASUREMENTS', 'Verify Measurements', 'MEDIUM', 1, TRUE),
  ('COLOR_CHANGE_WORKFLOW', 'ORDER_MATERIAL', 'Order Material', 'HIGH', 2, TRUE),
  ('COLOR_CHANGE_WORKFLOW', 'DISASSEMBLE', 'Disassemble Vehicle', 'HIGH', 3, TRUE),
  ('COLOR_CHANGE_WORKFLOW', 'PREP_VEHICLE', 'Prep Vehicle', 'HIGH', 4, TRUE),
  ('COLOR_CHANGE_WORKFLOW', 'INSTALL', 'Install Wrap', 'HIGH', 5, TRUE),
  ('COLOR_CHANGE_WORKFLOW', 'REASSEMBLE', 'Reassemble Vehicle', 'HIGH', 6, TRUE),
  ('COLOR_CHANGE_WORKFLOW', 'QUALITY_CHECK', 'Quality Check', 'HIGH', 7, TRUE),
  ('COLOR_CHANGE_WORKFLOW', 'CUSTOMER_PICKUP', 'Customer Pickup', 'MEDIUM', 8, TRUE),

  -- STICKERS
  ('STICKERS', 'FINALIZE_DESIGN', 'Finalize Artwork/Design', 'LOW', 1, TRUE),

  -- EMBROIDERY
  ('EMBROIDERY', 'DIGITIZE_DESIGN', 'Digitize Design', 'LOW', 1, TRUE),
  ('EMBROIDERY', 'CUTDOWN', 'Cutdown', 'MEDIUM', 2, TRUE),

  -- LABELS_OH_WORKFLOW
  ('LABELS_OH_WORKFLOW', 'FINALIZE_DESIGN', 'Finalize Design', 'MEDIUM', 1, TRUE),
  ('LABELS_OH_WORKFLOW', 'ORDER_MEDIA', 'Order Media', 'MEDIUM', 2, TRUE),
  ('LABELS_OH_WORKFLOW', 'PRINT', 'Print', 'MEDIUM', 3, TRUE),
  ('LABELS_OH_WORKFLOW', 'PACKAGE', 'Package', 'MEDIUM', 4, TRUE),

  -- LABELS_OD_WORKFLOW
  ('LABELS_OD_WORKFLOW', 'FINALIZE_DESIGN', 'Finalize Design', 'MEDIUM', 1, TRUE),
  ('LABELS_OD_WORKFLOW', 'ORDER_MEDIA', 'Order Media', 'MEDIUM', 2, TRUE),
  ('LABELS_OD_WORKFLOW', 'PRINT', 'Print', 'MEDIUM', 3, TRUE),
  ('LABELS_OD_WORKFLOW', 'PACKAGE', 'Package', 'MEDIUM', 4, TRUE),

  -- CAST_LET_GRAPH_WORKFLOW
  ('CAST_LET_GRAPH_WORKFLOW', 'FINALIZE_DESIGN', 'Finalize Artwork/Design', 'HIGH', 1, TRUE),
  ('CAST_LET_GRAPH_WORKFLOW', 'PRINT', 'Print', 'MEDIUM', 2, TRUE),
  ('CAST_LET_GRAPH_WORKFLOW', 'OUTGAS', 'Outgas', 'LOW', 3, TRUE),
  ('CAST_LET_GRAPH_WORKFLOW', 'LAMINATE', 'Laminate', 'MEDIUM', 4, TRUE),
  ('CAST_LET_GRAPH_WORKFLOW', 'PLOTTER_CUT', 'Plotter Cut', 'MEDIUM', 5, TRUE),
  ('CAST_LET_GRAPH_WORKFLOW', 'WEED', 'Weed', 'MEDIUM', 6, TRUE),
  ('CAST_LET_GRAPH_WORKFLOW', 'TRANSFER_TAPE', 'Apply Transfer Tape', 'MEDIUM', 7, TRUE),
  ('CAST_LET_GRAPH_WORKFLOW', 'PREP_VEHICLE', 'Prep Vehicle', 'HIGH', 8, TRUE),
  ('CAST_LET_GRAPH_WORKFLOW', 'INSTALL', 'Install', 'HIGH', 9, TRUE),
  ('CAST_LET_GRAPH_WORKFLOW', 'QUALITY_CHECK', 'Quality Check', 'HIGH', 10, TRUE),

  -- CAL_LET_GRAPH_WORKFLOW
  ('CAL_LET_GRAPH_WORKFLOW', 'FINALIZE_DESIGN', 'Finalize Artwork/Design', 'HIGH', 1, TRUE),
  ('CAL_LET_GRAPH_WORKFLOW', 'PRINT', 'Print', 'MEDIUM', 2, TRUE),
  ('CAL_LET_GRAPH_WORKFLOW', 'OUTGAS', 'Outgas', 'LOW', 3, TRUE),
  ('CAL_LET_GRAPH_WORKFLOW', 'LAMINATE', 'Laminate', 'MEDIUM', 4, TRUE),
  ('CAL_LET_GRAPH_WORKFLOW', 'PLOTTER_CUT', 'Plotter Cut', 'MEDIUM', 5, TRUE),
  ('CAL_LET_GRAPH_WORKFLOW', 'WEED', 'Weed', 'MEDIUM', 6, TRUE),
  ('CAL_LET_GRAPH_WORKFLOW', 'TRANSFER_TAPE', 'Apply Transfer Tape', 'MEDIUM', 7, TRUE),
  ('CAL_LET_GRAPH_WORKFLOW', 'PREP_VEHICLE', 'Prep Vehicle', 'HIGH', 8, TRUE),
  ('CAL_LET_GRAPH_WORKFLOW', 'INSTALL', 'Install', 'HIGH', 9, TRUE),
  ('CAL_LET_GRAPH_WORKFLOW', 'QUALITY_CHECK', 'Quality Check', 'HIGH', 10, TRUE),

  -- CAST_GRAPH_BULK_WORKFLOW
  ('CAST_GRAPH_BULK_WORKFLOW', 'FINALIZE_DESIGN', 'Finalize Artwork/Design', 'HIGH', 1, TRUE),
  ('CAST_GRAPH_BULK_WORKFLOW', 'PRINT', 'Print', 'MEDIUM', 2, TRUE),
  ('CAST_GRAPH_BULK_WORKFLOW', 'OUTGAS', 'Outgas', 'LOW', 3, TRUE),
  ('CAST_GRAPH_BULK_WORKFLOW', 'LAMINATE', 'Laminate', 'MEDIUM', 4, TRUE),
  ('CAST_GRAPH_BULK_WORKFLOW', 'HAND_CUT', 'Hand/Table Cut (if needed)', 'LOW', 5, TRUE),
  ('CAST_GRAPH_BULK_WORKFLOW', 'PREP_VEHICLE', 'Prep Vehicle', 'HIGH', 6, TRUE),
  ('CAST_GRAPH_BULK_WORKFLOW', 'INSTALL', 'Install', 'HIGH', 7, TRUE),
  ('CAST_GRAPH_BULK_WORKFLOW', 'QUALITY_CHECK', 'Quality Check', 'HIGH', 8, TRUE),

  -- VAN_INSERTS_WORKFLOW
  ('VAN_INSERTS_WORKFLOW', 'FINALIZE_DESIGN', 'Finalize Artwork/Design', 'HIGH', 1, TRUE),
  ('VAN_INSERTS_WORKFLOW', 'PRINT', 'Print', 'MEDIUM', 2, TRUE),
  ('VAN_INSERTS_WORKFLOW', 'OUTGAS', 'Outgas', 'LOW', 3, TRUE),
  ('VAN_INSERTS_WORKFLOW', 'LAMINATE', 'Laminate', 'MEDIUM', 4, TRUE),
  ('VAN_INSERTS_WORKFLOW', 'PLOTTER_CUT', 'Plotter Cut (Template)', 'MEDIUM', 5, TRUE),
  ('VAN_INSERTS_WORKFLOW', 'MARK_SIDES', 'Mark Driver/Passenger Side', 'MEDIUM', 6, TRUE),
  ('VAN_INSERTS_WORKFLOW', 'PACKAGE', 'Package for Transport', 'MEDIUM', 7, TRUE),
  ('VAN_INSERTS_WORKFLOW', 'PREP_VEHICLE', 'Prep Vehicle', 'HIGH', 8, TRUE),
  ('VAN_INSERTS_WORKFLOW', 'INSTALL', 'Install', 'HIGH', 9, TRUE),
  ('VAN_INSERTS_WORKFLOW', 'QUALITY_CHECK', 'Quality Check', 'HIGH', 10, TRUE),

  -- CUT_VINYL_WORKFLOW
  ('CUT_VINYL_WORKFLOW', 'FINALIZE_DESIGN', 'Finalize Artwork/Design', 'HIGH', 1, TRUE),
  ('CUT_VINYL_WORKFLOW', 'PLOTTER_CUT', 'Plotter Cut', 'MEDIUM', 2, TRUE),
  ('CUT_VINYL_WORKFLOW', 'WEED', 'Weed', 'MEDIUM', 3, TRUE),
  ('CUT_VINYL_WORKFLOW', 'TRANSFER_TAPE', 'Apply Transfer Tape', 'MEDIUM', 4, TRUE),
  ('CUT_VINYL_WORKFLOW', 'PREP_VEHICLE', 'Prep Vehicle', 'HIGH', 5, TRUE),
  ('CUT_VINYL_WORKFLOW', 'INSTALL', 'Install', 'HIGH', 6, TRUE),
  ('CUT_VINYL_WORKFLOW', 'QUALITY_CHECK', 'Quality Check', 'HIGH', 7, TRUE)
ON CONFLICT (template_key, task_key) DO NOTHING;

-- Update categories to link to their default templates
UPDATE categories SET template_key = 'CAST_LET_GRAPH_WORKFLOW' WHERE category_key = 'VINYL_GRAPHICS';
UPDATE categories SET template_key = 'PARTIAL_WRAP_WORKFLOW' WHERE category_key = 'VINYL_WRAP';
UPDATE categories SET template_key = 'PPF_WORKFLOW' WHERE category_key = 'PPF';
UPDATE categories SET template_key = 'EMBROIDERY' WHERE category_key = 'EMBROIDERY';
UPDATE categories SET template_key = 'STICKERS' WHERE category_key = 'STICKERS';

-- Add comment
COMMENT ON TABLE project_templates IS 'Production workflow templates imported from legacy Google Sheets system';
