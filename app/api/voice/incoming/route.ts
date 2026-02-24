import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const callSid = formData.get('CallSid') as string
    const from = formData.get('From') as string
    const to = formData.get('To') as string

    console.log('Incoming call:', { callSid, from, to })

    // Log the call
    const { error: insertError } = await supabase.from('calls').insert({
      direction: 'inbound',
      caller_phone: from,
      receiver_phone: to,
      status: 'ringing',
      call_sid: callSid,
      read: false
    })

    console.log('Insert error:', insertError)

    // Check for custom voice greeting
    const { data: greetingSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'call_greeting_url')
      .maybeSingle()

    const greetingUrl = greetingSetting?.value || null

    // Screen the call - ask caller to press 1 to filter out robocalls
    const screenUrl = `https://fwg-ops.vercel.app/api/voice/screen?callSid=${callSid}&amp;from=${encodeURIComponent(from)}&amp;to=${encodeURIComponent(to)}`

    // Use custom recording if available, otherwise fall back to TTS
    const greetingTwiml = greetingUrl
      ? `<Play>${greetingUrl}</Play>`
      : `<Say voice="alice">Thank you for calling Frederick Wraps and Graphics. To be connected, please press 1.</Say>`

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${screenUrl}" timeout="5">
    ${greetingTwiml}
  </Gather>
  <Hangup/>
</Response>`

    console.log('TwiML:', twiml)

    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (error) {
    console.error('Webhook error:', error)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again.</Say>
</Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
}

export async function GET() {
  return new NextResponse('Voice webhook active', { status: 200 })
}
