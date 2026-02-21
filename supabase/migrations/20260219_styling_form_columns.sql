-- =============================================
--  STYLING FORM COLUMNS
--  Adds columns to the submissions table for
--  the automotive styling inquiry form.
-- =============================================

-- Selected services (e.g. ['full_color_change', 'chrome_delete'])
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]'::jsonb;

-- Per-service detail answers (e.g. { "full_color_change": { "color": "Satin Black" } })
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS service_details JSONB DEFAULT '{}'::jsonb;

-- Array of public URLs for uploaded reference/inspiration images
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reference_image_urls TEXT[] DEFAULT '{}';
