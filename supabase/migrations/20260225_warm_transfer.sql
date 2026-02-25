-- Warm transfer support: add columns to calls table for conference-based transfer
ALTER TABLE calls ADD COLUMN IF NOT EXISTS agent_call_sid text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS conference_sid text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS conference_name text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transfer_status text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transfer_target_phone text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transfer_target_name text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transfer_target_call_sid text;

COMMENT ON COLUMN calls.agent_call_sid IS 'Call SID of the team member who answered (child leg)';
COMMENT ON COLUMN calls.conference_sid IS 'Twilio Conference SID when call is in conference mode';
COMMENT ON COLUMN calls.conference_name IS 'Twilio Conference friendly name (call-{callSid})';
COMMENT ON COLUMN calls.transfer_status IS 'Transfer state: initiating, connecting, briefing, completed, cancelled';
COMMENT ON COLUMN calls.transfer_target_phone IS 'Phone number of the warm transfer target';
COMMENT ON COLUMN calls.transfer_target_name IS 'Name of the warm transfer target';
COMMENT ON COLUMN calls.transfer_target_call_sid IS 'Call SID of the transfer target';
