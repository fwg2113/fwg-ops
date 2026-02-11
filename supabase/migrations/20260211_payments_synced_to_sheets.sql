-- Add synced_to_sheets column to payments table for duplicate prevention
ALTER TABLE payments ADD COLUMN IF NOT EXISTS synced_to_sheets BOOLEAN DEFAULT false;

-- Existing payments are NOT synced yet (leave as false so they can still be synced manually)
