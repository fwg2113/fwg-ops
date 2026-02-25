import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const callSid = url.searchParams.get('callSid')

    const formData = await request.formData()
    const dialCallStatus = formData.get('DialCallStatus') as string
    const dialCallDuration = formData.get('DialCallDuration') as string

    console.log('Call complete:', { callSid, dialCallStatus, dialCallDuration })

    // Check if this call is in transfer mode
    // When a warm transfer is initiated, the agent's call leg is redirected to a Conference,
    // which causes the Dial to "complete" even though the call was answered.
    const { data: callRecord } = await supabase
      .from('calls')
      .select('transfer_status')
      .eq('call_sid', callSid)
      .maybeSingle()

    if (callRecord?.transfer_status === 'initiating') {
      // Transfer in progress: put the caller into the Conference instead of voicemail
      const conferenceName = `call-${callSid}`
      const eventsUrl = `https://fwg-ops.vercel.app/api/voice/conference/events?callSid=${callSid}`

      console.log('Transfer mode: redirecting caller to conference', conferenceName)

      // Update conference name in DB
      await supabase
        .from('calls')
        .update({ conference_name: conferenceName })
        .eq('call_sid', callSid)

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
      beep="false"
      statusCallback="${eventsUrl}"
      statusCallbackEvent="join leave end">
      ${conferenceName}
    </Conference>
  </Dial>
</Response>`

      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }

    const duration = parseInt(dialCallDuration) || 0

    // Only treat as answered if someone actually picked up
    if (dialCallStatus === 'answered' || (dialCallStatus === 'completed' && duration > 0)) {
      await supabase
        .from('calls')
        .update({
          status: 'completed',
          duration: duration,
          read: true
        })
        .eq('call_sid', callSid)

      return new NextResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    // No answer - go to voicemail
    await supabase
      .from('calls')
      .update({ status: 'missed' })
      .eq('call_sid', callSid)

    const from = url.searchParams.get('from')
    const voicemailUrl = "https://ops.frederickwraps.com/api/voice/voicemail?callSid=" + callSid + "&amp;from=" + encodeURIComponent(from || "")
    const twiml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Say voice=\"alice\">No one is available. Please leave a message after the beep.</Say><Record maxLength=\"120\" action=\"" + voicemailUrl + "\" /></Response>"

    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (error) {
    console.error('Complete webhook error:', error)
    return new NextResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
      headers: { 'Content-Type': 'text/xml' }
    })
  }
}

export async function GET() {
  return new NextResponse('Complete webhook active', { status: 200 })
}
