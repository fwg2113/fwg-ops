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

    // Build dial targets with whisper URL so answering team member hears the category
    const whisperUrl = `https://fwg-ops.vercel.app/api/voice/whisper?category=${encodeURIComponent(category.label)}`
    const numbers = teamPhones.map(p => `<Number url="${whisperUrl}">${p.phone}</Number>`).join('\n    ')
    const sipUris = teamPhones
      .filter(p => p.sip_uri)
      .map(p => `<Sip url="${whisperUrl}">${p.sip_uri}</Sip>`)
      .join('\n    ')
    const actionUrl = `https://fwg-ops.vercel.app/api/voice/complete?callSid=${callSid}&amp;from=${encodeURIComponent(from)}`

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${category.message}</Say>
  <Dial callerId="${to}" timeout="40" answerOnBridge="true" action="${actionUrl}">
    <Client url="${whisperUrl}">ops-dashboard</Client>
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
