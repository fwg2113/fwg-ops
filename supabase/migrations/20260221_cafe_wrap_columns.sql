-- =============================================
--  CAFÉ EQUIPMENT WRAP COLUMNS
--  Adds columns to the submissions table for
--  the café equipment wraps inquiry form.
--
--  All columns are nullable with no defaults
--  so existing forms are completely unaffected.
-- =============================================

-- Customer's city
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS location_city TEXT;

-- Customer's state
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS location_state TEXT;

-- How equipment will be handled
-- Values: deliver_to_fwg, vendor_coordination, onsite, not_sure
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS delivery_method TEXT;

-- Whether customer has finalized branding
-- Values: ready, needs_adjustments, need_design
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS branding_status TEXT;
