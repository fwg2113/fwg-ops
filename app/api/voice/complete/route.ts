import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

// Called when dial completes (answered, no-answer, busy, etc.)
export async function POST(request: Request) {
  const url = new URL(request.url)
  const callSid = url.searchParams.get('callSid')
  const from = url.searchParams.get('from')
  const customerName = url.searchParams.get('customerName')
  
  const formData = await request.formData()
  const dialCallStatus = formData.get('DialCallStatus') as string
  const dialCallDuration = formData.get('DialCallDuration') as string
  const answeredBy = formData.get('DialCallSid') as string // The leg that was answered
  
  console.log('Call complete:', { callSid, dialCallStatus, dialCallDuration })

  if (dialCallStatus === 'completed' || dialCallStatus === 'answered') {
    // Call was answered
    await supabase
      .from('calls')
      .update({
        status: 'completed',
        duration: parseInt(dialCallDuration) || 0
      })
      .eq('call_sid', callSid)

    // Return empty response - call is done
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' }
    })
  }

  // Call was not answered - go to voicemail
  await supabase
    .from('calls')
    .update({ status: 'voicemail' })
    .eq('call_sid', callSid)

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling Frederick Wraps and Graphics. We're currently unavailable. Please leave a message after the beep and we'll get back to you as soon as possible.</Say>
  <Record maxLength="120" action="/api/voice/voicemail?callSid=${callSid}&from=${encodeURIComponent(from || '')}&customerName=${encodeURIComponent(customerName || '')}" transcribe="true" playBeep="true" />
  <Say voice="alice">We did not receive a recording. Goodbye.</Say>
</Response>`

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' }
  })
}

export async function GET() {
  return new NextResponse('Call complete webhook active', { status: 200 })
}
