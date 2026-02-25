import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

const CATEGORY_MAP: Record<string, { key: string; label: string; message: string }> = {
  '1': {
    key: 'vehicle-wraps-ppf',
    label: 'Vehicle Wraps & PPF',
    message: 'Great, one of our vehicle wrap specialists will be right with you.',
  },
  '2': {
    key: 'stickers-signage',
    label: 'Stickers & Signage',
    message: 'Great, one of our signage specialists will be right with you.',
  },
  '3': {
    key: 'apparel',
    label: 'Embroidery & Custom Apparel',
    message: 'Great, one of our apparel specialists will be right with you.',
  },
  '0': {
    key: 'general',
    label: 'General Inquiry',
    message: 'One moment please while we connect you.',
  },
}

// XML-escape helper for embedding values in TwiML
function xmlEscape(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const callSid = url.searchParams.get('callSid')
    const from = url.searchParams.get('from') || ''
    const to = url.searchParams.get('to') || ''

    const formData = await request.formData()
    const digits = formData.get('Digits') as string

    console.log('Menu selection:', { callSid, digits, from })

    const category = CATEGORY_MAP[digits]

    if (!category) {
      // Invalid digit — redirect back to menu to try again
      const retryUrl = `https://fwg-ops.vercel.app/api/voice/incoming?retry=1&amp;callSid=${callSid}&amp;from=${encodeURIComponent(from)}&amp;to=${encodeURIComponent(to)}`
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, that wasn't a valid option.</Say>
  <Redirect method="POST">${retryUrl}</Redirect>
</Response>`
      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }

    // Store category on the call record
    if (callSid) {
      await supabase
        .from('calls')
        .update({ category: category.key })
        .eq('call_sid', callSid)
    }

    // Check for a custom per-category greeting recording
    let categoryGreeting: { url: string } | null = null
    const { data: catGreetData, error: catGreetErr } = await supabase
      .from('greeting_recordings')
      .select('url')
      .eq('greeting_type', category.key)
      .eq('is_active', true)
      .maybeSingle()

    if (!catGreetErr) {
      categoryGreeting = catGreetData
    }
    // If greeting_type column doesn't exist, categoryGreeting stays null → TTS fallback

    // Use custom recording if available, otherwise TTS
    const categoryMessageTwiml = categoryGreeting?.url
      ? `<Play>${categoryGreeting.url}</Play>`
      : `<Say voice="alice">${xmlEscape(category.message)}</Say>`

    // Fetch team phones
    const { data: teamPhones } = await supabase
      .from('call_settings')
      .select('phone, name, sip_uri')
      .eq('enabled', true)
      .order('ring_order', { ascending: true })

    if (!teamPhones || teamPhones.length === 0) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">No team members are available right now. Please try again later.</Say>
</Response>`
      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }

    // Build dial targets — match the proven screen route pattern exactly
    const statusUrl = `https://fwg-ops.vercel.app/api/voice/status?callSid=${callSid}`
    const safeLabel = xmlEscape(category.label)
    // Use the business Twilio number (to) as callerId, NOT the caller's number (from).
    // Using the caller's number can cause Twilio to reject outbound legs.
    const dialCallerId = to || from
    const numbers = teamPhones.map(p => `<Number statusCallback="${statusUrl}" statusCallbackEvent="initiated ringing answered completed">${p.phone}</Number>`).join('\n    ')
    const sipUris = teamPhones
      .filter(p => p.sip_uri)
      .map(p => `<Sip statusCallback="${statusUrl}" statusCallbackEvent="initiated ringing answered completed">${p.sip_uri}</Sip>`)
      .join('\n    ')
    const actionUrl = `https://fwg-ops.vercel.app/api/voice/complete?callSid=${callSid}&amp;from=${encodeURIComponent(from)}`

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${categoryMessageTwiml}
  <Dial callerId="${dialCallerId}" timeout="40" answerOnBridge="true" action="${actionUrl}">
    <Client statusCallback="${statusUrl}" statusCallbackEvent="initiated ringing answered completed">
      <Identity>ops-dashboard</Identity>
      <Parameter name="categoryKey" value="${category.key}" />
      <Parameter name="categoryLabel" value="${safeLabel}" />
    </Client>
    ${numbers}
    ${sipUris}
  </Dial>
</Response>`

    console.log('Menu connecting TwiML:', twiml)

    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (error) {
    console.error('Menu webhook error:', error)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again.</Say>
</Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
}

export async function GET() {
  return new NextResponse('Menu webhook active', { status: 200 })
}
