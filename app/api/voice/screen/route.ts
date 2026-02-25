import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// Legacy screen route — kept for backwards compatibility with any in-flight calls.
// New calls use /api/voice/menu instead.
export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const callSid = url.searchParams.get('callSid')
    const from = url.searchParams.get('from') || ''
    const to = url.searchParams.get('to') || ''

    const formData = await request.formData()
    const digits = formData.get('Digits') as string

    console.log('Screen result (legacy):', { callSid, digits, from })

    // Caller pressed 1 - they're a real person, connect them
    if (digits === '1') {
      const { data: teamPhones, error: phoneError } = await supabase
        .from('call_settings')
        .select('phone, name, sip_uri')
        .eq('enabled', true)
        .order('ring_order', { ascending: true })

      console.log('Team phones:', teamPhones, 'Error:', phoneError)

      if (!teamPhones || teamPhones.length === 0) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">No team members are available right now. Please try again later.</Say>
</Response>`
        return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
      }

      // Ring browser clients, team phones, and SIP endpoints simultaneously
      const statusUrl = `https://fwg-ops.vercel.app/api/voice/status?callSid=${callSid}`
      const numbers = teamPhones.map(p => `<Number statusCallback="${statusUrl}" statusCallbackEvent="initiated ringing answered completed">${p.phone}</Number>`).join('\n    ')
      const sipUris = teamPhones
        .filter(p => p.sip_uri)
        .map(p => `<Sip statusCallback="${statusUrl}" statusCallbackEvent="initiated ringing answered completed">${p.sip_uri}</Sip>`)
        .join('\n    ')
      const actionUrl = `https://fwg-ops.vercel.app/api/voice/complete?callSid=${callSid}&amp;from=${encodeURIComponent(from)}`

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${from || to}" timeout="40" answerOnBridge="true" action="${actionUrl}">
    <Client statusCallback="${statusUrl}" statusCallbackEvent="initiated ringing answered completed">ops-dashboard</Client>
    ${numbers}
    ${sipUris}
  </Dial>
</Response>`

      console.log('Connecting caller TwiML:', twiml)

      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }

    // Wrong digit or bot - hang up and mark as screened
    console.log('Call screened out - digit pressed:', digits)

    if (callSid) {
      await supabase
        .from('calls')
        .update({ status: 'screened' })
        .eq('call_sid', callSid)
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`

    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (error) {
    console.error('Screen webhook error:', error)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again.</Say>
</Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
}

export async function GET() {
  return new NextResponse('Screen webhook active', { status: 200 })
}
