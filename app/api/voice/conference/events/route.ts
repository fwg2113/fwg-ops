import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { holdParticipant, createCall, hangupCall } from '../../../../lib/twilio'

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

    console.log('Conference event:', { event, callSid, conferenceSid, participantCallSid })

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
        .select('transfer_status, transfer_target_phone, agent_call_sid, call_sid, answered_by, caller_phone')
        .eq('call_sid', callSid)
        .maybeSingle()

      if (!callRecord) {
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
        try {
          await holdParticipant(conferenceSid, callerCallSid, true)
        } catch (e) {
          console.error('Failed to hold caller:', e)
        }

        // Look up customer name for the whisper
        let customerName: string | null = null
        const cleanPhone = (callRecord.caller_phone || '').replace(/\D/g, '')
        if (cleanPhone) {
          const { data: match } = await supabase
            .from('customer_phones')
            .select('customers(name)')
            .or(`phone.ilike.%${cleanPhone.slice(-10)}%`)
            .limit(1)
          if (match && match.length > 0 && match[0].customers) {
            customerName = (match[0].customers as any).name
          }
        }

        const whisperMessage = 'Call Transfer Request'

        // Call the transfer target
        const twilioNumber = process.env.TWILIO_PHONE_NUMBER
        if (callRecord.transfer_target_phone && twilioNumber) {
          const confName = `call-${callSid}`
          const targetJoinUrl = `https://fwg-ops.vercel.app/api/voice/conference/join?conf=${encodeURIComponent(confName)}&role=target&callSid=${callSid}&whisper=${encodeURIComponent(whisperMessage)}`

          // Look up SIP URI for the transfer target so we can show customer's caller ID
          const { data: targetSettings } = await supabase
            .from('call_settings')
            .select('sip_uri')
            .eq('phone', callRecord.transfer_target_phone)
            .eq('enabled', true)
            .maybeSingle()

          // If target has a SIP URI, call via SIP — Twilio allows any From for SIP calls,
          // so we can show the customer's phone number as the caller ID.
          const targetTo = targetSettings?.sip_uri || callRecord.transfer_target_phone
          const targetFrom = targetSettings?.sip_uri ? (callRecord.caller_phone || twilioNumber) : twilioNumber

          try {
            const targetCall = await createCall({
              to: targetTo,
              from: targetFrom,
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
          } catch (e) {
            console.error('Failed to call transfer target:', e)
            // Unhold the caller so they can still talk to the agent
            try {
              await holdParticipant(conferenceSid, callerCallSid, false)
            } catch (e2) {
              console.error('Failed to unhold caller after target call failure:', e2)
            }
            await supabase
              .from('calls')
              .update({ transfer_status: null, transfer_target_phone: null, transfer_target_name: null })
              .eq('call_sid', callSid)
          }
        } else {
          console.error('Cannot call transfer target: missing phone or TWILIO_PHONE_NUMBER env var', {
            targetPhone: callRecord.transfer_target_phone,
            hasTwilioNumber: !!twilioNumber,
          })
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

    // Handle agent leaving the conference before transfer is complete
    if (event === 'participant-leave') {
      const { data: callRecord } = await supabase
        .from('calls')
        .select('transfer_status, agent_call_sid, call_sid, transfer_target_call_sid')
        .eq('call_sid', callSid)
        .maybeSingle()

      if (callRecord && participantCallSid === callRecord.agent_call_sid) {
        // Agent left the conference
        const status = callRecord.transfer_status
        if (status === 'initiating' || status === 'connecting') {
          // Transfer wasn't completed — clean up: hang up target, unhold caller
          console.log('Agent left during incomplete transfer, cleaning up')
          if (callRecord.transfer_target_call_sid) {
            try { await hangupCall(callRecord.transfer_target_call_sid) } catch (e) { /* may already be gone */ }
          }
          try {
            await holdParticipant(conferenceSid, callRecord.call_sid, false)
          } catch (e) { /* caller might not be held */ }
          await supabase
            .from('calls')
            .update({ transfer_status: null, transfer_target_phone: null, transfer_target_name: null, transfer_target_call_sid: null })
            .eq('call_sid', callSid)
        }
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
