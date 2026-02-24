-- Add greeting_type column to greeting_recordings for per-category greetings
-- Values: 'main' (IVR menu greeting), or a category key for post-selection messages
-- Category keys: 'vehicle-wraps-ppf', 'stickers-signage', 'apparel', 'general'
ALTER TABLE greeting_recordings ADD COLUMN IF NOT EXISTS greeting_type text DEFAULT 'main';

COMMENT ON COLUMN greeting_recordings.greeting_type IS 'Type of greeting: main (IVR menu), or a category key for the message played after caller selects a menu option';

-- Only one active recording per greeting_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_greeting_recordings_active_type
  ON greeting_recordings (greeting_type)
  WHERE is_active = true;
