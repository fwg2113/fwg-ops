-- Weekly winners archive for No Idle Hands
CREATE TABLE nih_weekly_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  position INT NOT NULL CHECK (position IN (1, 2, 3)),
  team_member_id UUID REFERENCES nih_team_members(id),
  member_name TEXT NOT NULL,
  member_avatar_color TEXT NOT NULL DEFAULT '#6b7280',
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(week_start, position)
);

CREATE INDEX idx_nih_weekly_winners_week ON nih_weekly_winners(week_start DESC);
