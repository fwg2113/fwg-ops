import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  // Twilio sends form data
  const formData = await request.formData()
  
  const from = formData.get('From') as string
  const to = formData.get('To') as string
  const body = formData.get('Body') as string
  const messageSid = formData.get('MessageSid') as string

  if (!from || !body) {
    return new NextResponse('Missing required fields', { status: 400 })
  }

  // Clean phone number for lookup
  const cleanPhone = from.replace(/\D/g, '').slice(-10)

  // Try to find customer by phone
  const { data: customer } = await supabase
    .from('customers')
    .select('id, display_name, first_name, last_name')
    .or(`phone.ilike.%${cleanPhone}%,phone.ilike.%${from}%`)
    .limit(1)
    .single()

  const customerName = customer?.display_name || 
                       (customer?.first_name ? `${customer.first_name} ${customer.last_name}` : null)

  // Save message to database
  const { error } = await supabase.from('messages').insert([{
    direction: 'inbound',
    channel: 'sms',
    customer_phone: from,
    customer_name: customerName,
    message_body: body,
    message_sid: messageSid,
    status: 'received',
    read: false
  }])

  if (error) {
    console.error('Error saving message:', error)
  }

  // Return TwiML response (empty response = no auto-reply)
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
  
  return new NextResponse(twiml, {
    headers: {
      'Content-Type': 'text/xml',
    },
  })
}

// Also handle GET for webhook verification
export async function GET() {
  return new NextResponse('SMS webhook endpoint active', { status: 200 })
}
