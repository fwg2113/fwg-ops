import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { holdParticipant } from '../../../../lib/twilio'

/**
 * Status callback for the transfer target's call.
 * Tracks when the target doesn't answer or the call fails.
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const callSid = url.searchParams.get('callSid') // Parent call SID

    const formData = await request.formData()
    const callStatus = formData.get('CallStatus') as string

    console.log('Transfer target status:', { callSid, callStatus })

    // If target didn't answer or call failed, revert the transfer
    if (['no-answer', 'busy', 'failed', 'canceled'].includes(callStatus)) {
      const { data: callRecord } = await supabase
        .from('calls')
        .select('conference_sid, call_sid, agent_call_sid')
        .eq('call_sid', callSid)
        .maybeSingle()

      if (callRecord?.conference_sid) {
        // Unhold the caller so they can talk to the agent again
        try {
          await holdParticipant(callRecord.conference_sid, callRecord.call_sid, false)
        } catch (e) {
          console.error('Failed to unhold caller after target no-answer:', e)
        }
      }

      // Reset transfer state
      await supabase
        .from('calls')
        .update({
          transfer_status: null,
          transfer_target_phone: null,
          transfer_target_name: null,
          transfer_target_call_sid: null,
        })
        .eq('call_sid', callSid)

      console.log('Transfer target did not answer, reverting to agent')
    }

    return new NextResponse('OK', { status: 200 })
  } catch (error) {
    console.error('Transfer target status error:', error)
    return new NextResponse('OK', { status: 200 })
  }
}

export async function GET() {
  return new NextResponse('Transfer target status endpoint active', { status: 200 })
}
