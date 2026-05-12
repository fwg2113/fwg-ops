import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

// GET /api/voice/legs?callSid=<inbound CallSid>
// Returns the per-leg ring breakdown for one inbound call (for the green-phone
// panel's expanded view), plus the current "who's reachable" roster.
//   - mode=legs (default): [{ member_name, target_type, status, reason, duration, updated_at }, ...]
//   - mode=reachable: every enabled member with last_seen_at + a derived state.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('mode') || 'legs'

  if (mode === 'reachable') {
    const { data: members } = await supabaseAdmin
      .from('call_settings')
      .select('id, name, sip_uri, phone, enabled, ring_order, last_seen_at')
      .eq('enabled', true)
      .order('ring_order', { ascending: true })
    const now = Date.now()
    const roster = (members || []).map(m => {
      const seen = m.last_seen_at ? new Date(m.last_seen_at).getTime() : null
      const minsAgo = seen != null ? Math.round((now - seen) / 60000) : null
      const hasTarget = Boolean(m.sip_uri || m.phone)
      // "reachable" = a device rang for this member within the last ~30 min.
      const state = !hasTarget ? 'no-address'
        : minsAgo == null ? 'unknown'
        : minsAgo <= 30 ? 'reachable'
        : 'stale'
      return { id: m.id, name: m.name, hasTarget, lastSeenAt: m.last_seen_at, minsAgo, state }
    })
    return NextResponse.json({ roster })
  }

  const callSid = url.searchParams.get('callSid')
  if (!callSid) return NextResponse.json({ legs: [] })
  const { data: legs } = await supabaseAdmin
    .from('call_legs')
    .select('member_name, target_type, status, reason, duration, sip_response_code, updated_at')
    .eq('parent_call_sid', callSid)
    .order('updated_at', { ascending: true })
  return NextResponse.json({ legs: legs || [] })
}
