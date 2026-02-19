import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

/**
 * Handle outbound calls from SIP app
 * When someone dials a number from their SIP app (Oiga/Linphone),
 * Twilio sends a webhook here. We return TwiML to connect the call
 * using the business number as caller ID.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const callSid = formData.get('CallSid') as string
    const from = formData.get('From') as string // e.g. sip:jvolpe@fwg.sip.twilio.com
    const to = formData.get('To') as string     // e.g. sip:+15551234567@fwg.sip.twilio.com

    console.log('SIP outbound call:', { callSid, from, to })

    // Extract the phone number from the SIP To URI
    // Format: sip:+15551234567@fwg.sip.twilio.com or sip:15551234567@fwg.sip.twilio.com
    let dialNumber = to
    const sipMatch = to.match(/^sip:([^@]+)@/)
    if (sipMatch) {
      dialNumber = sipMatch[1]
    }
    // Clean up and normalize to E.164 format (+1XXXXXXXXXX)
    dialNumber = dialNumber.replace(/[^+\d]/g, '') // strip non-numeric except +
    if (dialNumber.startsWith('+')) {
      // Already has +, leave it (e.g. +15551234567)
    } else if (dialNumber.startsWith('1') && dialNumber.length === 11) {
      // 11 digits starting with 1 = US number with country code, just add +
      dialNumber = '+' + dialNumber
    } else if (dialNumber.length === 10) {
      // 10 digits = US number without country code, add +1
      dialNumber = '+1' + dialNumber
    } else {
      // Fallback: add + if missing
      dialNumber = '+' + dialNumber
    }

    console.log('SIP outbound parsed number:', { raw: to, parsed: dialNumber })

    const twilioNumber = process.env.TWILIO_PHONE_NUMBER
    if (!twilioNumber) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>System error. Twilio number not configured.</Say>
</Response>`
      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }

    // Log the outbound call
    await supabase.from('calls').insert({
      direction: 'outbound',
      caller_phone: twilioNumber,
      receiver_phone: dialNumber,
      status: 'initiated',
      call_sid: callSid
    })

    // Return TwiML to connect the call with business number as caller ID
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${twilioNumber}">
    <Number>${dialNumber}</Number>
  </Dial>
</Response>`

    console.log('SIP outbound TwiML:', twiml)

    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (error) {
    console.error('SIP outbound error:', error)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again.</Say>
</Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
}

export async function GET() {
  return new NextResponse('SIP outbound webhook active', { status: 200 })
}
