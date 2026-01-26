import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    
    const callSid = formData.get('CallSid') as string
    const from = formData.get('From') as string
    const to = formData.get('To') as string
    
    console.log('Incoming call:', { callSid, from, to })

    // Get enabled team phone numbers
    const { data: teamPhones, error: phoneError } = await supabase
      .from('call_settings')
      .select('phone, name')
      .eq('enabled', true)
      .order('ring_order', { ascending: true })

    console.log('Team phones:', teamPhones, 'Error:', phoneError)

    if (!teamPhones || teamPhones.length === 0) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>No team members available. Please try again later.</Say>
</Response>`
      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }

    // Log the call
    const { error: insertError } = await supabase.from('calls').insert({
      direction: 'inbound',
      caller_phone: from,
      receiver_phone: to,
      status: 'ringing',
      call_sid: callSid
    })
    
    console.log('Insert error:', insertError)

    // Build dial - escape & as &amp; for XML
    const numbers = teamPhones.map(p => `<Number>${p.phone}</Number>`).join('\n    ')
    const actionUrl = `https://fwg-ops.vercel.app/api/voice/complete?callSid=${callSid}&amp;from=${encodeURIComponent(from)}`

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${to}" timeout="12" action="${actionUrl}">
    ${numbers}
  </Dial>
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
