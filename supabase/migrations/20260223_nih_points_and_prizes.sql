-- Add points system to No Idle Hands

-- Add points column to tasks (0-25, how many points this task is worth)
ALTER TABLE nih_tasks ADD COLUMN points INT DEFAULT 0;

-- Add total_points to team members (running total, editable from Supabase)
ALTER TABLE nih_team_members ADD COLUMN total_points INT DEFAULT 0;

-- Prizes table (1st, 2nd, 3rd place — editable from Supabase dashboard)
CREATE TABLE nih_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position INT NOT NULL UNIQUE CHECK (position IN (1, 2, 3)),
  prize_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default prize slots
INSERT INTO nih_prizes (position, prize_text) VALUES
  (1, ''),
  (2, ''),
  (3, '');
