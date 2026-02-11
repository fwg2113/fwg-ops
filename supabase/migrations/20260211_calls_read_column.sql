-- Add read column to calls table for tracking unread missed/voicemail calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- Mark all existing calls as read so old calls don't flood the notification badge
UPDATE calls SET read = true WHERE read IS NULL;

-- Answered/completed calls should always be considered read
UPDATE calls SET read = true WHERE status = 'completed';
