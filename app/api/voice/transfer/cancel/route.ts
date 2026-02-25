import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { holdParticipant, hangupCall } from '../../../../lib/twilio'

/**
 * Cancel a warm transfer.
 *
 * Flow:
 *   1. Hang up the transfer target's call
 *   2. Unhold the caller
 *   3. Agent and caller continue talking in the conference
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
      .select('conference_sid, call_sid, transfer_target_call_sid, transfer_status')
      .eq('call_sid', callSid)
      .maybeSingle()

    if (error || !callRecord) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (!callRecord.conference_sid) {
      return NextResponse.json({ error: 'No active conference for this call' }, { status: 400 })
    }

    console.log('Cancelling warm transfer:', {
      callSid,
      targetCallSid: callRecord.transfer_target_call_sid,
    })

    // 1. Hang up the transfer target if they're on the line
    if (callRecord.transfer_target_call_sid) {
      try {
        await hangupCall(callRecord.transfer_target_call_sid)
      } catch (e) {
        // Target may not have answered yet or already hung up
        console.log('Target hangup error (may be expected):', e)
      }
    }

    // 2. Unhold the caller — reconnect with the agent
    try {
      await holdParticipant(callRecord.conference_sid, callRecord.call_sid, false)
    } catch (e) {
      console.error('Failed to unhold caller:', e)
    }

    // 3. Clear transfer state
    await supabase
      .from('calls')
      .update({
        transfer_status: null,
        transfer_target_phone: null,
        transfer_target_name: null,
        transfer_target_call_sid: null,
      })
      .eq('call_sid', callSid)

    console.log('Warm transfer cancelled — agent and caller reconnected')

    return NextResponse.json({
      success: true,
      message: 'Transfer cancelled — you are reconnected with the caller',
    })
  } catch (error: any) {
    console.error('Transfer cancel error:', error)
    return NextResponse.json({ error: error.message || 'Failed to cancel transfer' }, { status: 500 })
  }
}
