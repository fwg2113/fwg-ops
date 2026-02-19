import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const to = formData.get('To') as string
    const callSid = formData.get('CallSid') as string
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER!

    if (!to) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>No number specified.</Say>
</Response>`
      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }

    // Log the outbound call
    await supabase.from('calls').insert({
      direction: 'outbound',
      caller_phone: twilioNumber,
      receiver_phone: to,
      status: 'initiated',
      call_sid: callSid,
      read: true
    })

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${twilioNumber}">
    <Number>${to}</Number>
  </Dial>
</Response>`

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
