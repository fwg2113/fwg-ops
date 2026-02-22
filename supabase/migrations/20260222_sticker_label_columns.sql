-- =============================================
--  STICKER & LABEL INQUIRY COLUMNS
--  Adds columns to the submissions table for
--  the stickers & labels inquiry form.
--
--  All columns are nullable with no defaults
--  so existing forms are completely unaffected.
-- =============================================

-- Type of sticker product
-- Values: die-cut, kiss-cut, sticker-sheets, roll-labels
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS sticker_type TEXT;

-- Sticker shape
-- Values: contoured, circle, rounded-corners, sharp-corners, custom
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS shape TEXT;

-- Sticker material
-- Values: vinyl, holographic, clear, low-tack, unsure
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS material TEXT;

-- Sticker finish
-- Values: gloss, matte, unsure
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS finish TEXT;
