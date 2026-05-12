-- Optional link from a team-phone row (call_settings) to a team member, so a
-- per-user heartbeat (POST /api/voice/heartbeat { team_member_id }) can bump
-- last_seen_at by identity rather than name.
--
-- FWG-ops is single-tenant and has no team_members table / per-user auth, so
-- this is just a plain uuid column (no FK). Run alongside
-- add_call_legs_telemetry.sql.
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS team_member_id uuid;
CREATE INDEX IF NOT EXISTS call_settings_team_member_idx ON call_settings (team_member_id);
