-- Add SIP URI column to call_settings for SIP app calling (Path 2)
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS sip_uri text;

-- Example: sip:drew@fwg.sip.twilio.com
COMMENT ON COLUMN call_settings.sip_uri IS 'SIP URI for team member (e.g. sip:drew@yourdomain.sip.twilio.com)';
