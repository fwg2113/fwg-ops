-- Add read column to payments table for notification tracking
ALTER TABLE payments ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- Mark all existing payments as read (they've been seen already)
UPDATE payments SET read = true WHERE read IS NULL;
UPDATE payments SET read = true;
