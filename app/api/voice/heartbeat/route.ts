import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

// POST /api/voice/heartbeat
// Called on a ~60s interval from every open dashboard tab so the "who's
// reachable right now" panel stays accurate between calls.
//
// FWG-ops is single-tenant and has no per-user auth, so a heartbeat can only
// know which team member it is if the caller tells it. If a { name } (or
// { team_member_id }) is supplied we bump that call_settings row's
// last_seen_at; otherwise this is a harmless no-op. (The browser dashboard's
// own reachability is tracked client-side from the Twilio Device events.)
// Always non-fatal.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const name = typeof body.name === 'string' ? body.name : null
    const teamMemberId = typeof body.team_member_id === 'string' ? body.team_member_id : null
    const now = new Date().toISOString()

    if (teamMemberId) {
      await supabaseAdmin.from('call_settings').update({ last_seen_at: now }).eq('team_member_id', teamMemberId)
    } else if (name) {
      await supabaseAdmin.from('call_settings').update({ last_seen_at: now }).eq('name', name)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('voice heartbeat error (non-fatal):', err)
    return NextResponse.json({ ok: true })
  }
}
