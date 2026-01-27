import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  const formData = await request.formData()
  
  const from = formData.get('From') as string
  const body = formData.get('Body') as string
  const numMedia = parseInt(formData.get('NumMedia') as string || '0')
  
  let mediaUrl = null
  if (numMedia > 0) {
    mediaUrl = formData.get('MediaUrl0') as string
  }

  const cleanPhone = from.replace(/\D/g, '').slice(-10)

  const { data: customer } = await supabase
    .from('customers')
    .select('display_name')
    .or(`phone.ilike.%${cleanPhone}%`)
    .limit(1)
    .single()

  await supabase.from('messages').insert({
    direction: 'inbound',
    customer_phone: from,
    customer_name: customer?.display_name || null,
    message_body: body || '',
    media_url: mediaUrl,
    status: 'received',
    read: false
  })

  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
  
  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' }
  })
}

export async function GET() {
  return new NextResponse('SMS incoming webhook active', { status: 200 })
}
