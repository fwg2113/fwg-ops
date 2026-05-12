-- Per-leg ring telemetry for inbound calls.
-- One row per dialed <Sip>/<Number>/<Client> leg of an inbound call's <Dial>,
-- so the green-phone panel can show exactly who rang and what happened
-- ("Joey ✓ answered · Mason ✗ unreachable · Pereira — not dialed (no SIP)").
-- FWG is single-tenant, so no shop_id here (the FWT-ops copy has one).
CREATE TABLE IF NOT EXISTS call_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_call_sid text NOT NULL,           -- the inbound call's CallSid
  child_call_sid text NOT NULL DEFAULT '', -- this dialed leg's CallSid ('' for skipped legs that were never dialed)
  team_member_id uuid REFERENCES call_settings(id) ON DELETE SET NULL,
  member_name text,
  target text,                             -- the To value (sip:..., +1..., client:...)
  target_type text NOT NULL DEFAULT 'sip', -- 'sip' | 'cell' | 'client'
  status text NOT NULL DEFAULT 'initiated',-- initiated|ringing|answered|in-progress|completed|no-answer|busy|failed|canceled|unreachable|skipped
  sip_response_code int,
  duration int,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_call_sid, child_call_sid)
);

CREATE INDEX IF NOT EXISTS call_legs_parent_idx ON call_legs (parent_call_sid);
CREATE INDEX IF NOT EXISTS call_legs_member_seen_idx ON call_legs (member_name, created_at DESC);

-- Last-seen-reachable for the "who's reachable right now" panel: bumped by the
-- per-leg telemetry (when a member's leg reaches ringing/answered) and,
-- optionally, by a heartbeat from each open dashboard tab for the logged-in user.
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- RLS: mirror whatever the existing voice tables use. If `calls`/`call_settings`
-- are RLS-enabled with permissive policies, add matching ones here. If they have
-- RLS disabled (anon key has full access), this table is reachable as-is.
-- (Left to apply manually alongside the rest of the repo's RLS posture.)
