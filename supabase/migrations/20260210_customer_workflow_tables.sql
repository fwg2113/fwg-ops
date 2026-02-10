-- ============================================================================
-- FWG Ops - Customer Workflow System Migration
-- Created: 2026-02-10
--
-- This migration creates the template-driven customer action system,
-- mirroring the production workflow system but for customer-facing actions.
--
-- Tables:
-- 1. customer_workflow_templates - Workflow templates per category
-- 2. customer_workflow_steps - Step definitions within each template
-- 3. customer_actions - Generated action items (persistent, completable)
-- 4. Updates categories table with customer_template_key
-- ============================================================================

-- ============================================================================
-- 1. CUSTOMER WORKFLOW TEMPLATES
-- ============================================================================
-- Each category has a customer-facing workflow template that defines the
-- steps needed to manage the customer relationship for that job type.
-- Parallel to project_templates (which handles production workflows).
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  category_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 10 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cwt_category
  ON customer_workflow_templates(category_key);
CREATE INDEX IF NOT EXISTS idx_cwt_active
  ON customer_workflow_templates(active) WHERE active = true;

CREATE TRIGGER update_customer_workflow_templates_updated_at
  BEFORE UPDATE ON customer_workflow_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE customer_workflow_templates IS 'Customer-facing workflow templates per category (parallel to project_templates for production)';

-- ============================================================================
-- 2. CUSTOMER WORKFLOW STEPS
-- ============================================================================
-- Each template has ordered steps that define the customer-facing workflow.
-- Steps can auto-complete when a document reaches a certain status.
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  step_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  default_priority TEXT DEFAULT 'MEDIUM' NOT NULL,
  sort_order INTEGER NOT NULL,
  auto_complete_on_status TEXT,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(template_key, step_key)
);

CREATE INDEX IF NOT EXISTS idx_cws_template
  ON customer_workflow_steps(template_key);
CREATE INDEX IF NOT EXISTS idx_cws_active
  ON customer_workflow_steps(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_cws_sort
  ON customer_workflow_steps(template_key, sort_order);
CREATE INDEX IF NOT EXISTS idx_cws_auto_complete
  ON customer_workflow_steps(auto_complete_on_status) WHERE auto_complete_on_status IS NOT NULL;

ALTER TABLE customer_workflow_steps
  ADD CONSTRAINT fk_cws_template
  FOREIGN KEY (template_key)
  REFERENCES customer_workflow_templates(template_key)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

CREATE TRIGGER update_customer_workflow_steps_updated_at
  BEFORE UPDATE ON customer_workflow_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE customer_workflow_steps IS 'Ordered steps within a customer workflow template (parallel to template_tasks for production)';
COMMENT ON COLUMN customer_workflow_steps.auto_complete_on_status IS 'Document status that auto-completes this step (e.g., sent, approved, paid)';

-- ============================================================================
-- 3. CUSTOMER ACTIONS (Generated Instances)
-- ============================================================================
-- Actual action items generated from templates, linked to documents.
-- These are persistent, completable records that power the Command Center.
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID,
  submission_id UUID,
  template_key TEXT NOT NULL,
  step_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'TODO' NOT NULL,
  priority TEXT DEFAULT 'MEDIUM' NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  auto_complete_on_status TEXT,
  auto_generated BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ca_document
  ON customer_actions(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ca_submission
  ON customer_actions(submission_id) WHERE submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ca_status
  ON customer_actions(status);
CREATE INDEX IF NOT EXISTS idx_ca_pending
  ON customer_actions(status, sort_order) WHERE status = 'TODO';
CREATE INDEX IF NOT EXISTS idx_ca_auto_complete
  ON customer_actions(auto_complete_on_status, status)
  WHERE auto_complete_on_status IS NOT NULL AND status = 'TODO';

-- FK to documents (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents')
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_ca_document'
    ) THEN
    ALTER TABLE customer_actions
      ADD CONSTRAINT fk_ca_document
      FOREIGN KEY (document_id)
      REFERENCES documents(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- FK to submissions (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'submissions')
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_ca_submission'
    ) THEN
    ALTER TABLE customer_actions
      ADD CONSTRAINT fk_ca_submission
      FOREIGN KEY (submission_id)
      REFERENCES submissions(id)
      ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON TABLE customer_actions IS 'Generated customer-facing action items that power the Command Center (persistent, completable)';
COMMENT ON COLUMN customer_actions.auto_complete_on_status IS 'Denormalized from template step - document status that auto-completes this action';

-- ============================================================================
-- 4. ADD customer_template_key TO CATEGORIES TABLE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories')
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'categories' AND column_name = 'customer_template_key'
    ) THEN
    ALTER TABLE categories ADD COLUMN customer_template_key TEXT;
    COMMENT ON COLUMN categories.customer_template_key IS 'Default customer workflow template for this category';
  END IF;
END $$;

-- ============================================================================
-- 5. SEED CUSTOMER WORKFLOW TEMPLATES
-- ============================================================================
-- One template per category so each can be independently customized.
-- ============================================================================

INSERT INTO customer_workflow_templates (template_key, category_key, label, description, active, sort_order) VALUES
  -- Automotive
  ('FULL_WRAP_CUSTOMER', 'FULL_WRAP', 'Full Wrap - Customer Workflow', 'Customer-facing steps for full vehicle wraps', TRUE, 1),
  ('PARTIAL_WRAP_CUSTOMER', 'PARTIAL_WRAP', 'Partial Wrap - Customer Workflow', 'Customer-facing steps for partial wraps', TRUE, 2),
  ('VINYL_WRAP_CUSTOMER', 'VINYL_WRAP', 'Vinyl Wrap - Customer Workflow', 'Customer-facing steps for vinyl wraps', TRUE, 3),
  ('PPF_CUSTOMER', 'PPF', 'PPF - Customer Workflow', 'Customer-facing steps for paint protection film', TRUE, 4),
  ('COLOR_CHANGE_CUSTOMER', 'COLOR_CHANGE', 'Color Change - Customer Workflow', 'Customer-facing steps for color change wraps', TRUE, 5),
  ('VINYL_GRAPHICS_CUSTOMER', 'VINYL_GRAPHICS', 'Vinyl Graphics - Customer Workflow', 'Customer-facing steps for vinyl graphics', TRUE, 6),
  ('VINYL_LETTERING_CUSTOMER', 'VINYL_LETTERING', 'Vinyl Lettering - Customer Workflow', 'Customer-facing steps for vinyl lettering', TRUE, 7),
  ('WINDOW_TINT_CUSTOMER', 'WINDOW_TINT', 'Window Tint - Customer Workflow', 'Customer-facing steps for window tinting', TRUE, 8),
  ('CHROME_DELETE_CUSTOMER', 'CHROME_DELETE', 'Chrome Delete - Customer Workflow', 'Customer-facing steps for chrome delete', TRUE, 9),
  -- Signage
  ('SIGNAGE_CUSTOMER', 'SIGNAGE', 'Signage - Customer Workflow', 'Customer-facing steps for signage', TRUE, 10),
  ('YARD_SIGNS_CUSTOMER', 'YARD_SIGNS', 'Yard Signs - Customer Workflow', 'Customer-facing steps for yard signs', TRUE, 11),
  ('BANNERS_CUSTOMER', 'BANNERS', 'Banners - Customer Workflow', 'Customer-facing steps for banners', TRUE, 12),
  ('A_FRAMES_CUSTOMER', 'A_FRAMES', 'A-Frames - Customer Workflow', 'Customer-facing steps for A-frame signs', TRUE, 13),
  ('CHANNEL_LETTERS_CUSTOMER', 'CHANNEL_LETTERS', 'Channel Letters - Customer Workflow', 'Customer-facing steps for channel letters', TRUE, 14),
  -- Stickers & Labels
  ('STICKERS_CUSTOMER', 'STICKERS', 'Stickers - Customer Workflow', 'Customer-facing steps for stickers', TRUE, 15),
  ('KISS_CUT_STICKERS_CUSTOMER', 'KISS_CUT_STICKERS', 'Kiss Cut Stickers - Customer Workflow', 'Customer-facing steps for kiss cut stickers', TRUE, 16),
  ('DIE_CUT_STICKERS_CUSTOMER', 'DIE_CUT_STICKERS', 'Die Cut Stickers - Customer Workflow', 'Customer-facing steps for die cut stickers', TRUE, 17),
  ('LABELS_CUSTOMER', 'LABELS', 'Labels - Customer Workflow', 'Customer-facing steps for labels', TRUE, 18),
  ('LABELS_OH_CUSTOMER', 'LABELS_OH', 'Labels On Hand - Customer Workflow', 'Customer-facing steps for labels on hand', TRUE, 19),
  ('LABELS_OD_CUSTOMER', 'LABELS_OD', 'Labels On Demand - Customer Workflow', 'Customer-facing steps for labels on demand', TRUE, 20),
  -- Apparel
  ('APPAREL_CUSTOMER', 'APPAREL', 'Apparel - Customer Workflow', 'Customer-facing steps for apparel', TRUE, 21),
  ('DTF_TRANSFER_CUSTOMER', 'DTF_TRANSFER', 'DTF Transfer - Customer Workflow', 'Customer-facing steps for DTF transfers', TRUE, 22),
  ('DTF_CUSTOMER', 'DTF', 'DTF - Customer Workflow', 'Customer-facing steps for DTF', TRUE, 23),
  ('EMBROIDERY_CUSTOMER', 'EMBROIDERY', 'Embroidery - Customer Workflow', 'Customer-facing steps for embroidery', TRUE, 24),
  ('SCREEN_PRINT_CUSTOMER', 'SCREEN_PRINT', 'Screen Print - Customer Workflow', 'Customer-facing steps for screen printing', TRUE, 25),
  -- Design & Other
  ('DESIGN_FEE_CUSTOMER', 'DESIGN_FEE', 'Design Fee - Customer Workflow', 'Customer-facing steps for design work', TRUE, 26),
  ('DESIGN_CUSTOMER', 'DESIGN', 'Design - Customer Workflow', 'Customer-facing steps for design work', TRUE, 27),
  ('FOX_DECALS_CUSTOMER', 'FOX_DECALS', 'Fox Decals - Customer Workflow', 'Customer-facing steps for Fox decals', TRUE, 28),
  ('OTHER_CUSTOMER', 'OTHER', 'Other - Customer Workflow', 'Customer-facing steps for miscellaneous jobs', TRUE, 29)
ON CONFLICT (template_key) DO NOTHING;

-- ============================================================================
-- 6. SEED UNIVERSAL CUSTOMER WORKFLOW STEPS
-- ============================================================================
-- Every category gets the same 6 universal steps as a skeleton.
-- Each can be independently customized (add/remove/modify) per category.
-- ============================================================================

INSERT INTO customer_workflow_steps (template_key, step_key, label, description, default_priority, sort_order, auto_complete_on_status, active) VALUES
  -- FULL_WRAP
  ('FULL_WRAP_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('FULL_WRAP_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('FULL_WRAP_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('FULL_WRAP_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('FULL_WRAP_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('FULL_WRAP_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- PARTIAL_WRAP
  ('PARTIAL_WRAP_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('PARTIAL_WRAP_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('PARTIAL_WRAP_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('PARTIAL_WRAP_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('PARTIAL_WRAP_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('PARTIAL_WRAP_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- VINYL_WRAP
  ('VINYL_WRAP_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('VINYL_WRAP_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('VINYL_WRAP_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('VINYL_WRAP_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('VINYL_WRAP_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('VINYL_WRAP_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- PPF
  ('PPF_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('PPF_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('PPF_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('PPF_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('PPF_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('PPF_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- COLOR_CHANGE
  ('COLOR_CHANGE_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('COLOR_CHANGE_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('COLOR_CHANGE_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('COLOR_CHANGE_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('COLOR_CHANGE_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('COLOR_CHANGE_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- VINYL_GRAPHICS
  ('VINYL_GRAPHICS_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('VINYL_GRAPHICS_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('VINYL_GRAPHICS_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('VINYL_GRAPHICS_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('VINYL_GRAPHICS_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('VINYL_GRAPHICS_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- VINYL_LETTERING
  ('VINYL_LETTERING_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('VINYL_LETTERING_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('VINYL_LETTERING_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('VINYL_LETTERING_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('VINYL_LETTERING_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('VINYL_LETTERING_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- WINDOW_TINT
  ('WINDOW_TINT_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('WINDOW_TINT_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('WINDOW_TINT_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('WINDOW_TINT_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('WINDOW_TINT_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('WINDOW_TINT_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- CHROME_DELETE
  ('CHROME_DELETE_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('CHROME_DELETE_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('CHROME_DELETE_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('CHROME_DELETE_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('CHROME_DELETE_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('CHROME_DELETE_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- SIGNAGE
  ('SIGNAGE_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('SIGNAGE_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('SIGNAGE_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('SIGNAGE_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('SIGNAGE_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('SIGNAGE_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- YARD_SIGNS
  ('YARD_SIGNS_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('YARD_SIGNS_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('YARD_SIGNS_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('YARD_SIGNS_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('YARD_SIGNS_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('YARD_SIGNS_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- BANNERS
  ('BANNERS_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('BANNERS_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('BANNERS_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('BANNERS_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('BANNERS_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('BANNERS_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- A_FRAMES
  ('A_FRAMES_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('A_FRAMES_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('A_FRAMES_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('A_FRAMES_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('A_FRAMES_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('A_FRAMES_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- CHANNEL_LETTERS
  ('CHANNEL_LETTERS_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('CHANNEL_LETTERS_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('CHANNEL_LETTERS_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('CHANNEL_LETTERS_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('CHANNEL_LETTERS_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('CHANNEL_LETTERS_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- STICKERS
  ('STICKERS_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('STICKERS_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('STICKERS_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('STICKERS_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('STICKERS_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('STICKERS_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- KISS_CUT_STICKERS
  ('KISS_CUT_STICKERS_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('KISS_CUT_STICKERS_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('KISS_CUT_STICKERS_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('KISS_CUT_STICKERS_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('KISS_CUT_STICKERS_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('KISS_CUT_STICKERS_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- DIE_CUT_STICKERS
  ('DIE_CUT_STICKERS_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('DIE_CUT_STICKERS_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('DIE_CUT_STICKERS_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('DIE_CUT_STICKERS_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('DIE_CUT_STICKERS_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('DIE_CUT_STICKERS_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- LABELS
  ('LABELS_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('LABELS_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('LABELS_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('LABELS_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('LABELS_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('LABELS_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- LABELS_OH
  ('LABELS_OH_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('LABELS_OH_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('LABELS_OH_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('LABELS_OH_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('LABELS_OH_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('LABELS_OH_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- LABELS_OD
  ('LABELS_OD_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('LABELS_OD_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('LABELS_OD_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('LABELS_OD_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('LABELS_OD_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('LABELS_OD_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- APPAREL
  ('APPAREL_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('APPAREL_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('APPAREL_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('APPAREL_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('APPAREL_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('APPAREL_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- DTF_TRANSFER
  ('DTF_TRANSFER_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('DTF_TRANSFER_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('DTF_TRANSFER_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('DTF_TRANSFER_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('DTF_TRANSFER_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('DTF_TRANSFER_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- DTF
  ('DTF_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('DTF_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('DTF_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('DTF_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('DTF_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('DTF_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- EMBROIDERY
  ('EMBROIDERY_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('EMBROIDERY_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('EMBROIDERY_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('EMBROIDERY_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('EMBROIDERY_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('EMBROIDERY_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- SCREEN_PRINT
  ('SCREEN_PRINT_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('SCREEN_PRINT_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('SCREEN_PRINT_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('SCREEN_PRINT_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('SCREEN_PRINT_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('SCREEN_PRINT_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- DESIGN_FEE
  ('DESIGN_FEE_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('DESIGN_FEE_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('DESIGN_FEE_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('DESIGN_FEE_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('DESIGN_FEE_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('DESIGN_FEE_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- DESIGN
  ('DESIGN_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('DESIGN_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('DESIGN_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('DESIGN_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('DESIGN_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('DESIGN_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- FOX_DECALS
  ('FOX_DECALS_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('FOX_DECALS_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('FOX_DECALS_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('FOX_DECALS_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('FOX_DECALS_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('FOX_DECALS_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE),

  -- OTHER
  ('OTHER_CUSTOMER', 'REVIEW_AND_CATEGORIZE', 'Review & categorize submission', 'Review the incoming submission and categorize the project', 'HIGH', 1, 'draft', TRUE),
  ('OTHER_CUSTOMER', 'SEND_QUOTE', 'Send quote to customer', 'Prepare and send the quote to the customer', 'HIGH', 2, 'sent', TRUE),
  ('OTHER_CUSTOMER', 'FOLLOW_UP_QUOTE', 'Follow up on quote', 'Follow up with customer on the sent quote', 'MEDIUM', 3, 'approved', TRUE),
  ('OTHER_CUSTOMER', 'COLLECT_PAYMENT', 'Collect payment', 'Collect payment or set up net terms', 'HIGH', 4, 'paid', TRUE),
  ('OTHER_CUSTOMER', 'SCHEDULE_JOB', 'Schedule job', 'Schedule the job date with the customer', 'MEDIUM', 5, NULL, TRUE),
  ('OTHER_CUSTOMER', 'NOTIFY_COMPLETION', 'Notify customer of completion', 'Notify the customer that their job is complete and ready', 'MEDIUM', 6, NULL, TRUE)
ON CONFLICT (template_key, step_key) DO NOTHING;

-- ============================================================================
-- 7. LINK CATEGORIES TO CUSTOMER TEMPLATES
-- ============================================================================

UPDATE categories SET customer_template_key = 'FULL_WRAP_CUSTOMER' WHERE category_key = 'FULL_WRAP';
UPDATE categories SET customer_template_key = 'PARTIAL_WRAP_CUSTOMER' WHERE category_key = 'PARTIAL_WRAP';
UPDATE categories SET customer_template_key = 'VINYL_WRAP_CUSTOMER' WHERE category_key = 'VINYL_WRAP';
UPDATE categories SET customer_template_key = 'PPF_CUSTOMER' WHERE category_key = 'PPF';
UPDATE categories SET customer_template_key = 'COLOR_CHANGE_CUSTOMER' WHERE category_key = 'COLOR_CHANGE';
UPDATE categories SET customer_template_key = 'VINYL_GRAPHICS_CUSTOMER' WHERE category_key = 'VINYL_GRAPHICS';
UPDATE categories SET customer_template_key = 'VINYL_LETTERING_CUSTOMER' WHERE category_key = 'VINYL_LETTERING';
UPDATE categories SET customer_template_key = 'WINDOW_TINT_CUSTOMER' WHERE category_key = 'WINDOW_TINT';
UPDATE categories SET customer_template_key = 'CHROME_DELETE_CUSTOMER' WHERE category_key = 'CHROME_DELETE';
UPDATE categories SET customer_template_key = 'SIGNAGE_CUSTOMER' WHERE category_key = 'SIGNAGE';
UPDATE categories SET customer_template_key = 'YARD_SIGNS_CUSTOMER' WHERE category_key = 'YARD_SIGNS';
UPDATE categories SET customer_template_key = 'BANNERS_CUSTOMER' WHERE category_key = 'BANNERS';
UPDATE categories SET customer_template_key = 'A_FRAMES_CUSTOMER' WHERE category_key = 'A_FRAMES';
UPDATE categories SET customer_template_key = 'CHANNEL_LETTERS_CUSTOMER' WHERE category_key = 'CHANNEL_LETTERS';
UPDATE categories SET customer_template_key = 'STICKERS_CUSTOMER' WHERE category_key = 'STICKERS';
UPDATE categories SET customer_template_key = 'KISS_CUT_STICKERS_CUSTOMER' WHERE category_key = 'KISS_CUT_STICKERS';
UPDATE categories SET customer_template_key = 'DIE_CUT_STICKERS_CUSTOMER' WHERE category_key = 'DIE_CUT_STICKERS';
UPDATE categories SET customer_template_key = 'LABELS_CUSTOMER' WHERE category_key = 'LABELS';
UPDATE categories SET customer_template_key = 'LABELS_OH_CUSTOMER' WHERE category_key = 'LABELS_OH';
UPDATE categories SET customer_template_key = 'LABELS_OD_CUSTOMER' WHERE category_key = 'LABELS_OD';
UPDATE categories SET customer_template_key = 'APPAREL_CUSTOMER' WHERE category_key = 'APPAREL';
UPDATE categories SET customer_template_key = 'DTF_TRANSFER_CUSTOMER' WHERE category_key = 'DTF_TRANSFER';
UPDATE categories SET customer_template_key = 'DTF_CUSTOMER' WHERE category_key = 'DTF';
UPDATE categories SET customer_template_key = 'EMBROIDERY_CUSTOMER' WHERE category_key = 'EMBROIDERY';
UPDATE categories SET customer_template_key = 'SCREEN_PRINT_CUSTOMER' WHERE category_key = 'SCREEN_PRINT';
UPDATE categories SET customer_template_key = 'DESIGN_FEE_CUSTOMER' WHERE category_key = 'DESIGN_FEE';
UPDATE categories SET customer_template_key = 'DESIGN_CUSTOMER' WHERE category_key = 'DESIGN';
UPDATE categories SET customer_template_key = 'FOX_DECALS_CUSTOMER' WHERE category_key = 'FOX_DECALS';
UPDATE categories SET customer_template_key = 'OTHER_CUSTOMER' WHERE category_key = 'OTHER';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
