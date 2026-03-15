import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const BUSINESS_ADDRESS = '5726 Industry Ln Suite I, Frederick, MD 21704'
const BUSINESS_PHONE = '(240) 575-7562'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { document_id, type, channels, pickup_location } = body

  if (!document_id || !type || !channels?.length) {
    return NextResponse.json({ error: 'document_id, type, and channels required' }, { status: 400 })
  }

  // Fetch document info
  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .select('customer_name, customer_email, customer_phone, doc_number, tracking_number, fulfillment_type')
    .eq('id', document_id)
    .single()

  if (docErr || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const customerName = doc.customer_name || 'Customer'
  const firstName = customerName.split(' ')[0]
  const results: { email?: any; sms?: any } = {}

  // Build notification content
  let subject = ''
  let emailHtml = ''
  let smsMessage = ''

  if (type === 'pickup') {
    subject = `Your order #${doc.doc_number} is ready for pickup!`
    emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Your Order is Ready! 🎉</h2>
        <p>Hi ${firstName},</p>
        <p>Great news — your order <strong>#${doc.doc_number}</strong> is ready for pickup!</p>
        ${pickup_location ? `<p><strong>Location:</strong> ${pickup_location}</p>` : ''}
        <p><strong>Pickup Address:</strong><br/>${BUSINESS_ADDRESS}</p>
        <p><strong>Phone:</strong> ${BUSINESS_PHONE}</p>
        <p>Our hours are Monday–Friday, 9am–5pm. If you need to arrange a different time, just give us a call or reply to this email.</p>
        <p>Thank you for your business!</p>
        <p style="color: #64748b;">— The Frederick Wraps Team</p>
      </div>
    `
    smsMessage = `Hi ${firstName}! Your order #${doc.doc_number} is ready for pickup at ${BUSINESS_ADDRESS}.${pickup_location ? ` Location: ${pickup_location}.` : ''} Questions? Call us at ${BUSINESS_PHONE}`
  } else if (type === 'shipped') {
    const trackingUrl = doc.tracking_number
      ? `https://track.easypost.com/djE6dHJrXw==${doc.tracking_number}`
      : null
    subject = `Your order #${doc.doc_number} has been shipped!`
    emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Your Order Has Shipped! 📦</h2>
        <p>Hi ${firstName},</p>
        <p>Your order <strong>#${doc.doc_number}</strong> is on its way!</p>
        ${doc.tracking_number ? `
          <p><strong>Tracking Number:</strong> ${doc.tracking_number}</p>
          ${trackingUrl ? `<p><a href="${trackingUrl}" style="color: #2563eb;">Track Your Package →</a></p>` : ''}
        ` : ''}
        <p>If you have any questions about your order, feel free to reply to this email or call us at ${BUSINESS_PHONE}.</p>
        <p>Thank you for your business!</p>
        <p style="color: #64748b;">— The Frederick Wraps Team</p>
      </div>
    `
    smsMessage = `Hi ${firstName}! Your order #${doc.doc_number} has shipped!${doc.tracking_number ? ` Tracking: ${doc.tracking_number}` : ''} Questions? Call ${BUSINESS_PHONE}`
  } else {
    return NextResponse.json({ error: 'Invalid type. Use "pickup" or "shipped"' }, { status: 400 })
  }

  // Send email
  if (channels.includes('email') && doc.customer_email) {
    try {
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey) {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Frederick Wraps <quotes@frederickwraps.com>',
            to: [doc.customer_email],
            subject,
            html: emailHtml,
          }),
        })
        results.email = await emailRes.json()
      }
    } catch (e) {
      console.error('Email notification error:', e)
      results.email = { error: 'Failed to send email' }
    }
  }

  // Send SMS
  if (channels.includes('sms') && doc.customer_phone) {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const fromNumber = process.env.TWILIO_PHONE_NUMBER
      if (accountSid && authToken && fromNumber) {
        let formattedTo = doc.customer_phone.replace(/\D/g, '')
        if (formattedTo.length === 10) formattedTo = '+1' + formattedTo
        else if (!formattedTo.startsWith('+')) formattedTo = '+' + formattedTo

        const smsRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ To: formattedTo, From: fromNumber, Body: smsMessage }),
          }
        )
        results.sms = await smsRes.json()

        // Log to messages table
        await supabase.from('messages').insert({
          direction: 'outbound',
          customer_phone: formattedTo,
          message_body: smsMessage,
          status: 'sent',
          read: true,
        })
      }
    } catch (e) {
      console.error('SMS notification error:', e)
      results.sms = { error: 'Failed to send SMS' }
    }
  }

  // Update document with notification timestamp
  await supabase
    .from('documents')
    .update({
      customer_notified_at: new Date().toISOString(),
      notification_method: channels.join('+'),
      ...(pickup_location ? { pickup_location } : {}),
    })
    .eq('id', document_id)

  return NextResponse.json({ success: true, results })
}
