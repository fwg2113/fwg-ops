import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '../../../lib/supabase'

// Called for each phone/SIP/Client leg that's dialed, with status updates.
// Also records per-leg ring telemetry into `call_legs` so the green-phone
// panel can show exactly who rang and what happened.
export async function POST(request: Request) {
  const url = new URL(request.url)
  const callSid = url.searchParams.get('callSid')

  const formData = await request.formData()
  const callStatus = formData.get('CallStatus') as string
  const childCallSid = formData.get('CallSid') as string // This child leg's SID
  const to = formData.get('To') as string // The team member's phone / sip uri / client identity
  const duration = formData.get('CallDuration') as string
  const sipResponseCodeRaw = formData.get('SipResponseCode') as string | null
  const sipResponseCode = sipResponseCodeRaw && /^\d+$/.test(sipResponseCodeRaw) ? parseInt(sipResponseCodeRaw, 10) : null

  console.log('Call status update:', { callSid, childCallSid, callStatus, to, duration, sipResponseCode })

  // ---- Per-leg ring telemetry (non-fatal — never block call handling) ----
  const parentCallSid = callSid || (formData.get('ParentCallSid') as string) || ''
  if (parentCallSid && childCallSid) {
    try {
      const dur = parseInt(duration || '0', 10) || 0
      const targetType = to?.startsWith('sip:') ? 'sip' : to?.startsWith('client:') ? 'client' : 'cell'

      let memberId: string | null = null
      let memberName: string | null = targetType === 'client' ? 'Dashboard' : null
      if (targetType === 'sip' || targetType === 'cell') {
        const { data } = await supabaseAdmin
          .from('call_settings')
          .select('id, name')
          .eq(targetType === 'sip' ? 'sip_uri' : 'phone', to)
          .maybeSingle()
        memberId = data?.id ?? null
        memberName = data?.name ?? null
      }

      let status = callStatus || 'initiated'
      let reason: string | null = null
      if (callStatus === 'in-progress' || callStatus === 'answered') {
        status = 'answered'
      } else if (callStatus === 'completed') {
        if (dur > 0) status = 'answered'
        else if (sipResponseCode === 486) { status = 'busy'; reason = 'line busy' }
        else if (sipResponseCode === 480 || sipResponseCode === 408 || sipResponseCode === 503) { status = 'unreachable'; reason = 'device not registered' }
        else status = 'no-answer'
      } else if (callStatus === 'busy') {
        status = 'busy'; reason = 'line busy'
      } else if (callStatus === 'failed') {
        status = sipResponseCode === 486 ? 'busy' : 'unreachable'
        reason = sipResponseCode === 486 ? 'line busy' : 'device not registered'
      } else if (callStatus === 'no-answer') {
        status = 'no-answer'
      } else if (callStatus === 'canceled') {
        status = 'canceled'; reason = 'another team member answered'
      }

      await supabaseAdmin.from('call_legs').upsert({
        parent_call_sid: parentCallSid,
        child_call_sid: childCallSid,
        team_member_id: memberId,
        member_name: memberName,
        target: to || null,
        target_type: targetType,
        status,
        sip_response_code: sipResponseCode,
        duration: dur || null,
        reason,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'parent_call_sid,child_call_sid' })

      // A leg only rings if a device was registered at that moment — use it as
      // a "last seen reachable" heartbeat for the who's-reachable panel.
      if (memberId && (callStatus === 'ringing' || status === 'answered')) {
        await supabaseAdmin.from('call_settings').update({ last_seen_at: new Date().toISOString() }).eq('id', memberId)
      }
    } catch (err) {
      console.error('call_legs telemetry error (non-fatal):', err)
    }
  }
  // ------------------------------------------------------------------------

  // If this leg was answered, record who answered and their call SID (for warm transfer)
  if (callStatus === 'in-progress' || callStatus === 'answered') {
    // Find team member name - try phone first, then SIP URI
    let teamMember: { name: string } | null = null

    if (to?.startsWith('sip:')) {
      const { data } = await supabase
        .from('call_settings')
        .select('name')
        .eq('sip_uri', to)
        .single()
      teamMember = data
    }

    if (!teamMember && to) {
      const { data } = await supabase
        .from('call_settings')
        .select('name')
        .eq('phone', to)
        .single()
      teamMember = data
    }

    // Also try matching by client identity (browser-based calls)
    if (!teamMember && to?.startsWith('client:')) {
      // Browser client — just mark the call as in-progress
      await supabase
        .from('calls')
        .update({
          answered_by: 'Dashboard',
          agent_call_sid: childCallSid,
          status: 'in-progress'
        })
        .eq('call_sid', callSid)
    } else if (teamMember) {
      await supabase
        .from('calls')
        .update({
          answered_by: teamMember.name,
          agent_call_sid: childCallSid,
          status: 'in-progress'
        })
        .eq('call_sid', callSid)
    } else if (to) {
      // Unknown target but still answered — mark in-progress
      await supabase
        .from('calls')
        .update({
          agent_call_sid: childCallSid,
          status: 'in-progress'
        })
        .eq('call_sid', callSid)
    }
  }

  // If completed, update duration
  if (callStatus === 'completed' && duration) {
    await supabase
      .from('calls')
      .update({
        status: 'completed',
        duration: parseInt(duration) || 0
      })
      .eq('call_sid', callSid)
  }

  return new NextResponse('OK', { status: 200 })
}

export async function GET() {
  return new NextResponse('Status webhook active', { status: 200 })
}
