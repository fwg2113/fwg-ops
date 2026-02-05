-- ============================================================================
-- Phase 5.1: Automations - Settings Table
-- Add automation settings to control automated workflows
-- ============================================================================

-- Create automation_settings table to store enable/disable states for automations
CREATE TABLE IF NOT EXISTS automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  label TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for quick lookups by automation key
CREATE INDEX IF NOT EXISTS idx_automation_settings_key
  ON automation_settings(automation_key);

-- Insert default automation configurations
INSERT INTO automation_settings (automation_key, enabled, label, description) VALUES
  ('auto_production_on_payment', false, 'Auto-move to Production on Payment', 'Automatically move invoice to production and generate tasks when any payment is received (deposit or full payment)'),
  ('notify_customer_on_completion', false, 'Customer Notification on Completion', 'Send SMS/email to customer when all line item tasks are completed')
ON CONFLICT (automation_key) DO NOTHING;

-- Add comments to document the table
COMMENT ON TABLE automation_settings IS 'Controls automated workflow triggers and actions';
COMMENT ON COLUMN automation_settings.automation_key IS 'Unique identifier for the automation (e.g., auto_production_on_payment)';
COMMENT ON COLUMN automation_settings.enabled IS 'Whether the automation is currently active';
COMMENT ON COLUMN automation_settings.label IS 'Human-readable name for UI display';
COMMENT ON COLUMN automation_settings.description IS 'Detailed explanation of what the automation does';
