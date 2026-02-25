import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { holdParticipant, removeParticipant } from '../../../../lib/twilio'

/**
 * Complete the warm transfer.
 *
 * Flow:
 *   1. Unhold the caller (they can now hear the transfer target)
 *   2. Remove the agent from the conference
 *   3. Caller and target continue talking
 *
 * Body: { callSid: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { callSid } = body

    if (!callSid) {
      return NextResponse.json({ error: 'callSid is required' }, { status: 400 })
    }

    const { data: callRecord, error } = await supabase
      .from('calls')
      .select('conference_sid, agent_call_sid, call_sid, transfer_status, transfer_target_name')
      .eq('call_sid', callSid)
      .maybeSingle()

    if (error || !callRecord) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (!callRecord.conference_sid) {
      return NextResponse.json({ error: 'No active conference for this call' }, { status: 400 })
    }

    if (!['connecting', 'briefing'].includes(callRecord.transfer_status || '')) {
      return NextResponse.json({ error: `Cannot complete transfer in state: ${callRecord.transfer_status}` }, { status: 400 })
    }

    console.log('Completing warm transfer:', {
      callSid,
      conferenceSid: callRecord.conference_sid,
      agentCallSid: callRecord.agent_call_sid,
    })

    // 1. Unhold the caller — they can now hear the transfer target
    await holdParticipant(callRecord.conference_sid, callRecord.call_sid, false)

    // 2. Remove the agent from the conference (agent is done)
    if (callRecord.agent_call_sid) {
      try {
        await removeParticipant(callRecord.conference_sid, callRecord.agent_call_sid)
      } catch (e) {
        // Agent may have already hung up — that's fine
        console.log('Agent may have already left:', e)
      }
    }

    // 3. Update the call record
    await supabase
      .from('calls')
      .update({
        transfer_status: 'completed',
        answered_by: callRecord.transfer_target_name || 'transferred',
      })
      .eq('call_sid', callSid)

    console.log('Warm transfer completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Transfer completed — caller is now connected to the target',
    })
  } catch (error: any) {
    console.error('Transfer complete error:', error)
    return NextResponse.json({ error: error.message || 'Failed to complete transfer' }, { status: 500 })
  }
}
