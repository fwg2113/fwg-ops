import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { findConference, holdParticipant, createCall } from '../../../../lib/twilio'

/**
 * Conference status callback webhook.
 * Handles participant join/leave events to drive the warm transfer flow.
 *
 * Transfer flow:
 *   1. Agent is redirected to Conference → agent joins
 *   2. Caller joins Conference (via complete/route.ts) → we hold caller + call target
 *   3. Target joins Conference → transfer_status = 'briefing'
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const callSid = url.searchParams.get('callSid') // Parent call SID

    const formData = await request.formData()
    const event = formData.get('StatusCallbackEvent') as string
    const conferenceSid = formData.get('ConferenceSid') as string
    const participantCallSid = formData.get('CallSid') as string
    const friendlyName = formData.get('FriendlyName') as string

    console.log('Conference event:', { event, callSid, conferenceSid, participantCallSid, friendlyName })

    if (!callSid) {
      return new NextResponse('OK', { status: 200 })
    }

    // Store the conference SID
    if (event === 'participant-join' || event === 'conference-start') {
      await supabase
        .from('calls')
        .update({ conference_sid: conferenceSid })
        .eq('call_sid', callSid)
    }

    if (event === 'participant-join') {
      // Get the current call record to determine transfer state
      const { data: callRecord } = await supabase
        .from('calls')
        .select('transfer_status, transfer_target_phone, agent_call_sid, call_sid')
        .eq('call_sid', callSid)
        .maybeSingle()

      if (!callRecord) {
        return new NextResponse('OK', { status: 200 })
      }

      // Count current participants
      const conf = await findConference(friendlyName)
      if (!conf) {
        console.log('Conference not found:', friendlyName)
        return new NextResponse('OK', { status: 200 })
      }

      // When transfer_status is 'initiating' and the CALLER just joined
      // (not the agent who joins first) → Hold the caller and call the transfer target
      if (callRecord.transfer_status === 'initiating' && participantCallSid !== callRecord.agent_call_sid) {
        // The caller just joined. The agent is already in the conference.
        // Hold the caller so agent can talk to target privately.
        const callerCallSid = callRecord.call_sid // Parent call SID = caller

        console.log('Holding caller and calling transfer target:', {
          callerCallSid,
          targetPhone: callRecord.transfer_target_phone,
        })

        // Hold the caller
        await holdParticipant(conferenceSid, callerCallSid, true)

        // Call the transfer target
        const twilioNumber = process.env.TWILIO_PHONE_NUMBER
        if (callRecord.transfer_target_phone && twilioNumber) {
          const targetJoinUrl = `https://fwg-ops.vercel.app/api/voice/conference/join?conf=${encodeURIComponent(friendlyName)}&role=target&callSid=${callSid}&whisper=${encodeURIComponent('Incoming transfer from Frederick Wraps.')}`

          const targetCall = await createCall({
            to: callRecord.transfer_target_phone,
            from: twilioNumber,
            url: targetJoinUrl,
            statusCallback: `https://fwg-ops.vercel.app/api/voice/transfer/target-status?callSid=${callSid}`,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
          })

          // Store target call SID and update status
          await supabase
            .from('calls')
            .update({
              transfer_status: 'connecting',
              transfer_target_call_sid: targetCall.sid,
            })
            .eq('call_sid', callSid)

          console.log('Transfer target call created:', targetCall.sid)
        }
      }

      // When a third participant joins and we're in connecting state → briefing phase
      if (callRecord.transfer_status === 'connecting' && participantCallSid !== callRecord.agent_call_sid && participantCallSid !== callRecord.call_sid) {
        console.log('Transfer target joined conference, briefing phase')
        await supabase
          .from('calls')
          .update({ transfer_status: 'briefing' })
          .eq('call_sid', callSid)
      }
    }

    if (event === 'conference-end') {
      // Conference ended — clean up transfer state if any
      await supabase
        .from('calls')
        .update({
          transfer_status: null,
          conference_sid: null,
          conference_name: null,
        })
        .eq('call_sid', callSid)
        .not('status', 'eq', 'completed')
    }

    return new NextResponse('OK', { status: 200 })
  } catch (error) {
    console.error('Conference events error:', error)
    return new NextResponse('OK', { status: 200 })
  }
}

export async function GET() {
  return new NextResponse('Conference events endpoint active', { status: 200 })
}
