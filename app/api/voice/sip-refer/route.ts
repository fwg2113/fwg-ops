import { NextResponse } from 'next/server'

/**
 * Handles SIP REFER transfers from the softphone app.
 *
 * When a SIP endpoint (like Oiga/Linphone) does an attended transfer:
 *   1. The softphone puts the current call on hold
 *   2. The softphone makes a new call to the target
 *   3. The softphone sends a SIP REFER to Twilio
 *   4. Twilio creates a new call using this webhook URL
 *   5. This endpoint returns TwiML to connect the referred call
 *
 * Twilio SIP Domain configuration:
 *   - Set the SIP domain's Voice URL to this endpoint
 *   - Enable "SIP REFER" in the Twilio SIP domain settings
 *
 * The ReferTo header from the SIP REFER tells us where to connect.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const referTo = formData.get('ReferTo') as string
    const from = formData.get('From') as string
    const to = formData.get('To') as string
    const callSid = formData.get('CallSid') as string

    console.log('SIP REFER received:', { referTo, from, to, callSid })

    if (!referTo) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Transfer target not specified.</Say>
</Response>`
      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }

    // Extract the phone number from the SIP URI (e.g., "sip:+15551234567@..." → "+15551234567")
    let targetNumber = referTo
    const sipMatch = referTo.match(/sip:([^@]+)/)
    if (sipMatch) {
      targetNumber = sipMatch[1]
    }

    // If it's a SIP URI, dial as SIP
    // If it's a phone number, dial as Number
    const isSipUri = referTo.startsWith('sip:') && referTo.includes('@')
    const callerIdNumber = process.env.TWILIO_PHONE_NUMBER || to

    let dialTarget: string
    if (isSipUri && !targetNumber.startsWith('+')) {
      dialTarget = `<Sip>${referTo}</Sip>`
    } else {
      // Ensure phone number format
      const formatted = targetNumber.startsWith('+') ? targetNumber : `+1${targetNumber.replace(/\D/g, '')}`
      dialTarget = `<Number>${formatted}</Number>`
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerIdNumber}">
    ${dialTarget}
  </Dial>
</Response>`

    console.log('SIP REFER TwiML:', twiml)

    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (error) {
    console.error('SIP REFER error:', error)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Transfer failed. Please try again.</Say>
</Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
}

export async function GET() {
  return new NextResponse('SIP REFER handler active', { status: 200 })
}
