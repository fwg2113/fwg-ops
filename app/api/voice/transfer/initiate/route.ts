import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { redirectCall } from '../../../../lib/twilio'

/**
 * Initiate a warm transfer.
 *
 * Flow:
 *   1. Set transfer_status = 'initiating' in DB
 *   2. Redirect the agent's call leg to a Conference room
 *   3. This breaks the Dial bridge → complete/route.ts fires for the caller
 *   4. complete/route.ts detects transfer mode → puts caller in the same Conference
 *   5. Conference events webhook detects both joined → holds caller, calls target
 *
 * Body: { callSid: string, targetPhone: string, targetName?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { callSid, targetPhone, targetName } = body

    if (!callSid || !targetPhone) {
      return NextResponse.json({ error: 'callSid and targetPhone are required' }, { status: 400 })
    }

    // Look up the call to get the agent's call SID
    const { data: callRecord, error } = await supabase
      .from('calls')
      .select('agent_call_sid, status')
      .eq('call_sid', callSid)
      .maybeSingle()

    if (error || !callRecord) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (!callRecord.agent_call_sid) {
      return NextResponse.json({ error: 'No agent call SID found — call may not be connected yet' }, { status: 400 })
    }

    if (callRecord.status !== 'in-progress') {
      return NextResponse.json({ error: 'Call is not active' }, { status: 400 })
    }

    // Format the target phone number
    const formattedTarget = targetPhone.startsWith('+') ? targetPhone : `+1${targetPhone.replace(/\D/g, '')}`

    // Set transfer state BEFORE redirecting (so complete/route.ts knows to use Conference)
    const conferenceName = `call-${callSid}`
    await supabase
      .from('calls')
      .update({
        transfer_status: 'initiating',
        transfer_target_phone: formattedTarget,
        transfer_target_name: targetName || null,
        conference_name: conferenceName,
      })
      .eq('call_sid', callSid)

    // Redirect the agent's call leg to the Conference
    // This breaks the Dial bridge, causing the caller's Dial action URL to fire
    const conferenceJoinUrl = `https://fwg-ops.vercel.app/api/voice/conference/join?conf=${encodeURIComponent(conferenceName)}&role=agent&callSid=${callSid}`

    await redirectCall(callRecord.agent_call_sid, conferenceJoinUrl)

    console.log('Warm transfer initiated:', {
      callSid,
      agentCallSid: callRecord.agent_call_sid,
      targetPhone: formattedTarget,
      conferenceName,
    })

    return NextResponse.json({
      success: true,
      message: 'Transfer initiated — caller will be held while you speak with the target',
      conferenceName,
    })
  } catch (error: any) {
    console.error('Transfer initiate error:', error)
    return NextResponse.json({ error: error.message || 'Failed to initiate transfer' }, { status: 500 })
  }
}
