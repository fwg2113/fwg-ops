-- Add category column to calls table for IVR menu selection tracking
ALTER TABLE calls ADD COLUMN IF NOT EXISTS category text;
COMMENT ON COLUMN calls.category IS 'IVR menu category selected by caller (e.g. vehicle-wraps-ppf, stickers-signage, apparel, general)';

-- Create greeting_recordings table for recording library
CREATE TABLE IF NOT EXISTS greeting_recordings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  r2_key text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE greeting_recordings IS 'Library of voice greeting recordings for the IVR phone menu';
COMMENT ON COLUMN greeting_recordings.name IS 'Display name (e.g. Main Greeting, Holiday 2026, Summer Special)';
COMMENT ON COLUMN greeting_recordings.url IS 'Public R2 URL for the audio file';
COMMENT ON COLUMN greeting_recordings.r2_key IS 'R2 storage key for deletion';
COMMENT ON COLUMN greeting_recordings.is_active IS 'Only one recording should be active at a time';

-- Enable realtime for greeting_recordings
ALTER PUBLICATION supabase_realtime ADD TABLE greeting_recordings;
