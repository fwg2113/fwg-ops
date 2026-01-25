import { NextResponse } from 'next/server'
import { supabase } from '../../lib/supabase'

export async function POST(request: Request) {
  const { documentId, to, subject, message } = await request.json()

  if (!documentId || !to) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
  }

  // Get document
  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Get line items
  const { data: lineItems } = await supabase
    .from('line_items')
    .select('*')
    .eq('document_id', documentId)
    .order('sort_order')

  const isQuote = doc.doc_type === 'quote'
  const docType = isQuote ? 'Quote' : 'Invoice'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fwg-ops.vercel.app'
  const pdfUrl = `${appUrl}/api/pdf?id=${documentId}`

  // Build email HTML
  const emailHtml = buildEmailHtml(doc, lineItems || [], docType, pdfUrl, message)
  const emailSubject = subject || `${docType} #${doc.doc_number} from Frederick Wraps`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Frederick Wraps <quotes@frederickwraps.com>',
        to: [to],
        subject: emailSubject,
        html: emailHtml,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend error:', data)
      return NextResponse.json({ error: data.message || 'Failed to send email' }, { status: 400 })
    }

    // Update document status
    await supabase
      .from('documents')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', documentId)

    return NextResponse.json({ success: true, messageId: data.id })
  } catch (error) {
    console.error('Email error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}

function buildEmailHtml(doc: any, lineItems: any[], docType: string, pdfUrl: string, customMessage?: string) {
  const lineItemsHtml = lineItems.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: left;">${item.description || '-'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${(item.unit_price || 0).toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${(item.line_total || 0).toFixed(2)}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #d71cd1 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Frederick Wraps Group</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px;">${docType} #${doc.doc_number}</h2>
              
              <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi ${doc.customer_name?.split(' ')[0] || 'there'},
              </p>
              
              <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                ${customMessage || `Thank you for your interest in Frederick Wraps Group! Please find your ${docType.toLowerCase()} details below.`}
              </p>

              ${doc.project_description ? `
              <div style="background: #f8f8f8; padding: 15px 20px; border-radius: 8px; margin-bottom: 30px;">
                <p style="color: #888; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase;">Project</p>
                <p style="color: #333; font-size: 14px; margin: 0;">${doc.project_description}</p>
              </div>
              ` : ''}

              <!-- Line Items -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr style="background: #f8f8f8;">
                  <th style="padding: 12px; text-align: left; font-size: 12px; color: #666; text-transform: uppercase;">Description</th>
                  <th style="padding: 12px; text-align: center; font-size: 12px; color: #666; text-transform: uppercase;">Qty</th>
                  <th style="padding: 12px; text-align: right; font-size: 12px; color: #666; text-transform: uppercase;">Price</th>
                  <th style="padding: 12px; text-align: right; font-size: 12px; color: #666; text-transform: uppercase;">Total</th>
                </tr>
                ${lineItemsHtml || '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #999;">No items</td></tr>'}
              </table>

              <!-- Total -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="60%"></td>
                  <td width="40%">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #666;">Subtotal</td>
                        <td style="padding: 8px 0; text-align: right; color: #333;">$${(doc.subtotal || 0).toFixed(2)}</td>
                      </tr>
                      ${doc.discount_amount > 0 ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666;">Discount</td>
                        <td style="padding: 8px 0; text-align: right; color: #22c55e;">-$${(doc.discount_amount || 0).toFixed(2)}</td>
                      </tr>
                      ` : ''}
                      <tr style="border-top: 2px solid #333;">
                        <td style="padding: 15px 0; color: #333; font-size: 18px; font-weight: bold;">Total</td>
                        <td style="padding: 15px 0; text-align: right; color: #d71cd1; font-size: 24px; font-weight: bold;">$${(doc.total || 0).toFixed(2)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${pdfUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #d71cd1 0%, #8b5cf6 100%); color: white; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">View ${docType}</a>
              </div>

              <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 0;">
                If you have any questions, feel free to reply to this email or call us at (240) 693-3715.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8f8f8; padding: 30px; text-align: center;">
              <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">Frederick Wraps Group</p>
              <p style="color: #999; font-size: 12px; margin: 0;">5728 Industry Lane, Frederick, MD 21704</p>
              <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">(240) 693-3715 | info@frederickwraps.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}
