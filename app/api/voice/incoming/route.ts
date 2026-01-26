import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

// Handle incoming calls - forward to team phones
export async function POST(request: Request) {
  const formData = await request.formData()
  
  const callSid = formData.get('CallSid') as string
  const from = formData.get('From') as string
  const to = formData.get('To') as string
  const callStatus = formData.get('CallStatus') as string
  
  console.log('Incoming call:', { callSid, from, to, callStatus })

  // Clean phone number for customer lookup
  const cleanPhone = from.replace(/\D/g, '').slice(-10)

  // Try to find customer by phone
  const { data: customer } = await supabase
    .from('customers')
    .select('display_name')
    .or(`phone.ilike.%${cleanPhone}%,phone.ilike.%${from}%`)
    .limit(1)
    .single()

  // Also check customer_phones table
  let customerName = customer?.display_name
  if (!customerName) {
    const { data: phoneLink } = await supabase
      .from('customer_phones')
      .select('contact_name, customers(display_name)')
      .or(`phone.ilike.%${cleanPhone}%,phone.ilike.%${from}%`)
      .limit(1)
      .single()
    
    if (phoneLink) {
      customerName = phoneLink.contact_name || (phoneLink.customers as any)?.display_name
    }
  }

  // Log the call
  await supabase.from('calls').insert({
    direction: 'inbound',
    caller_phone: from,
    caller_name: customerName || null,
    receiver_phone: to,
    status: 'ringing',
    call_sid: callSid
  })

  // Get enabled team phone numbers
  const { data: teamPhones } = await supabase
    .from('call_settings')
    .select('phone, name')
    .eq('enabled', true)
    .order('ring_order', { ascending: true })

  if (!teamPhones || teamPhones.length === 0) {
    // No team phones enabled - go to voicemail
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling Frederick Wraps and Graphics. We're currently unavailable. Please leave a message after the beep and we'll get back to you as soon as possible.</Say>
  <Record maxLength="120" action="/api/voice/voicemail?callSid=${callSid}&from=${encodeURIComponent(from)}" transcribe="true" />
  <Say voice="alice">We did not receive a recording. Goodbye.</Say>
</Response>`
    
    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' }
    })
  }

  // Build simultaneous dial to all team phones
  // Using Twilio's <Dial> with multiple <Number> elements rings them simultaneously
  const numberElements = teamPhones.map(p => 
    `<Number statusCallback="/api/voice/status?callSid=${callSid}" statusCallbackEvent="initiated ringing answered completed">${p.phone}</Number>`
  ).join('\n      ')

  // Caller ID will show the Twilio number (your business number)
  // timeout of 25 seconds before going to voicemail
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${to}" timeout="25" action="/api/voice/complete?callSid=${callSid}&from=${encodeURIComponent(from)}&customerName=${encodeURIComponent(customerName || '')}">
    ${numberElements}
  </Dial>
</Response>`

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' }
  })
}

export async function GET() {
  return new NextResponse('Voice webhook endpoint active', { status: 200 })
}
