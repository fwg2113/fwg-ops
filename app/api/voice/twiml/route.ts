import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  try {
    // Parse the form body - Twilio sends application/x-www-form-urlencoded
    const body = await request.text()
    const params = new URLSearchParams(body)
    const to = params.get('To')
    const from = params.get('From')
    const callSid = params.get('CallSid')
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER

    console.log('TwiML request:', { to, from, callSid, twilioNumber: !!twilioNumber })

    if (!to) {
      console.error('No "To" parameter in TwiML request')
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>No number specified.</Say>
</Response>`
      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }

    if (!twilioNumber) {
      console.error('TWILIO_PHONE_NUMBER env var not set')
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Phone system is not configured.</Say>
</Response>`
      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }

    // Log the outbound call (non-blocking)
    supabase.from('calls').insert({
      direction: 'outbound',
      caller_phone: twilioNumber,
      receiver_phone: to,
      status: 'initiated',
      call_sid: callSid || null,
      read: true
    }).then(({ error }) => {
      if (error) console.error('Failed to log outbound call:', error)
    })

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${twilioNumber}" answerOnBridge="true">
    <Number>${to}</Number>
  </Dial>
</Response>`

    console.log('Returning TwiML:', twiml)
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (error) {
    console.error('TwiML generation error:', error)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again.</Say>
</Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
}

// GET handler to verify endpoint is reachable
export async function GET() {
  return new NextResponse('TwiML endpoint active', { status: 200 })
}
