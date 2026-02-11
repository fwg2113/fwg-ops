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

  // Send email alert (non-blocking)
  sendEmailAlert(from, body, customer?.display_name || null, cleanPhone).catch(err =>
    console.error('Email alert failed:', err)
  )

  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' }
  })
}

export async function GET() {
  return new NextResponse('SMS incoming webhook active', { status: 200 })
}

async function sendEmailAlert(phone: string, messageBody: string, customerName: string | null, cleanPhone: string) {
  // Check if email alerts are enabled
  const { data: settingsRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'notification_settings')
    .single()

  const rawValue = settingsRow?.value
  const settings = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue
  if (!settings?.email_alerts_enabled || !settings?.email_alert_address) return

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) return

  const formattedPhone = cleanPhone.length === 10
    ? `(${cleanPhone.slice(0, 3)}) ${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`
    : phone

  const senderName = customerName || formattedPhone
  const messagesUrl = `https://ops.frederickwraps.com/messages?phone=${cleanPhone}`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'FWG Ops <quotes@frederickwraps.com>',
      to: settings.email_alert_address,
      subject: `New SMS from ${senderName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #d71cd1, #9333ea); padding: 20px 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">New Text Message</h2>
          </div>
          <div style="background: #1a1a2e; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #2d2d44; border-top: none;">
            <div style="margin-bottom: 16px;">
              <div style="color: #94a3b8; font-size: 13px; margin-bottom: 4px;">From</div>
              <div style="color: #f1f5f9; font-size: 16px; font-weight: 600;">${senderName}${customerName ? ` (${formattedPhone})` : ''}</div>
            </div>
            <div style="background: #111827; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <p style="color: #e2e8f0; font-size: 15px; margin: 0; line-height: 1.5; white-space: pre-wrap;">${messageBody || '(no text - media attached)'}</p>
            </div>
            <a href="${messagesUrl}" style="display: inline-block; background: #d71cd1; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">
              View in Message Hub
            </a>
          </div>
        </div>
      `,
    }),
  })
}
