import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// Parent call status callback — handles the inbound call leg itself.
// This catches cases where the caller hangs up during IVR (before any
// menu selection or Dial), which the child-leg /api/voice/status/ never sees.
//
// Configure this URL as the StatusCallback on the Twilio phone number or TwiML App:
//   https://fwg-ops.vercel.app/api/voice/call-status
//   StatusCallbackEvent: initiated ringing answered completed

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const callSid = formData.get('CallSid') as string
    const callStatus = formData.get('CallStatus') as string
    const duration = formData.get('CallDuration') as string

    console.log('Parent call status:', { callSid, callStatus, duration })

    if (!callSid) {
      return new NextResponse('OK', { status: 200 })
    }

    // Only act on terminal statuses
    if (callStatus === 'completed' || callStatus === 'canceled' || callStatus === 'no-answer' || callStatus === 'busy' || callStatus === 'failed') {
      // Check if the call is still in 'ringing' state — meaning nobody answered
      // and no other webhook already updated it
      const { data: call } = await supabase
        .from('calls')
        .select('status')
        .eq('call_sid', callSid)
        .maybeSingle()

      if (call && (call.status === 'ringing' || call.status === 'queued')) {
        // Call ended without ever being answered or handled
        const newStatus = callStatus === 'completed' && parseInt(duration) > 0
          ? 'completed'
          : 'missed'

        await supabase
          .from('calls')
          .update({
            status: newStatus,
            duration: parseInt(duration) || 0,
          })
          .eq('call_sid', callSid)

        console.log(`Parent call ${callSid} updated: ${call.status} → ${newStatus}`)
      }
    }

    return new NextResponse('OK', { status: 200 })
  } catch (error) {
    console.error('Parent call status error:', error)
    return new NextResponse('OK', { status: 200 })
  }
}

export async function GET() {
  return new NextResponse('Parent call status webhook active', { status: 200 })
}
