import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

const DEFAULT_MENU_TTS = `<Say voice="alice">Thank you for calling Frederick Wraps and Graphics.
Press 1 for Vehicle Wraps and Paint Protection Film.
Press 2 for Stickers and Signage.
Press 3 for Embroidery and Custom Printed Apparel.
Press 0 to speak with someone directly.</Say>`

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const callSid = formData.get('CallSid') as string
    const from = formData.get('From') as string
    const to = formData.get('To') as string

    // Check if this is a retry (menu replay on timeout)
    const url = new URL(request.url)
    const retry = parseInt(url.searchParams.get('retry') || '0')
    const existingCallSid = url.searchParams.get('callSid')
    const existingFrom = url.searchParams.get('from')
    const existingTo = url.searchParams.get('to')

    const effectiveCallSid = existingCallSid || callSid
    const effectiveFrom = existingFrom || from
    const effectiveTo = existingTo || to

    console.log('Incoming call:', { callSid: effectiveCallSid, from: effectiveFrom, to: effectiveTo, retry })

    // Only insert call record on first attempt (not retries)
    if (retry === 0) {
      const { error: insertError } = await supabase.from('calls').insert({
        direction: 'inbound',
        caller_phone: effectiveFrom,
        receiver_phone: effectiveTo,
        status: 'ringing',
        call_sid: effectiveCallSid,
        read: false
      })
      console.log('Insert error:', insertError)
    }

    // Max 3 menu replays before hanging up
    if (retry >= 3) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We're sorry, we didn't receive your selection. Please try calling again. Goodbye.</Say>
  <Hangup/>
</Response>`
      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }

    // Fetch active greeting recording from the library
    const { data: activeGreeting } = await supabase
      .from('greeting_recordings')
      .select('url')
      .eq('is_active', true)
      .maybeSingle()

    // Fall back to legacy single greeting setting
    let greetingUrl = activeGreeting?.url || null
    if (!greetingUrl) {
      const { data: legacySetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'call_greeting_url')
        .maybeSingle()
      greetingUrl = legacySetting?.value || null
    }

    // Build the menu action URL
    const menuUrl = `https://fwg-ops.vercel.app/api/voice/menu?callSid=${effectiveCallSid}&amp;from=${encodeURIComponent(effectiveFrom)}&amp;to=${encodeURIComponent(effectiveTo)}`

    // Build the retry URL for timeout (no input)
    const nextRetry = retry + 1
    const retryUrl = `https://fwg-ops.vercel.app/api/voice/incoming?retry=${nextRetry}&amp;callSid=${effectiveCallSid}&amp;from=${encodeURIComponent(effectiveFrom)}&amp;to=${encodeURIComponent(effectiveTo)}`

    // Use custom recording if available, otherwise TTS menu
    const greetingTwiml = greetingUrl
      ? `<Play>${greetingUrl}</Play>`
      : DEFAULT_MENU_TTS

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${menuUrl}" timeout="7">
    ${greetingTwiml}
  </Gather>
  <Redirect method="POST">${retryUrl}</Redirect>
</Response>`

    console.log('IVR TwiML:', twiml)

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
