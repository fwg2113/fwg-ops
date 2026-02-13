import { NextResponse } from 'next/server'
import { getGmailAccessToken, sendEmail, type EmailAttachment } from '../../../lib/gmail'

export async function POST(request: Request) {
  const accessToken = await getGmailAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 401 })
  }

  try {
    const { subject, body, attachmentUrls } = await request.json() as {
      subject: string
      body: string
      attachmentUrls?: { url: string; filename: string }[]
    }

    if (!subject || !body) {
      return NextResponse.json({ error: 'Missing required fields: subject, body' }, { status: 400 })
    }

    // Download attachments from URLs
    const attachments: EmailAttachment[] = []
    if (attachmentUrls && attachmentUrls.length > 0) {
      for (const att of attachmentUrls) {
        const res = await fetch(att.url)
        if (!res.ok) {
          console.error(`Failed to download attachment: ${att.filename}`)
          continue
        }
        const buffer = Buffer.from(await res.arrayBuffer())
        const contentType = res.headers.get('content-type') || 'application/octet-stream'
        attachments.push({
          filename: att.filename,
          mimeType: contentType,
          data: buffer,
        })
      }
    }

    const result = await sendEmail(accessToken, {
      to: 'zayn.thedesignpals@gmail.com',
      from: 'info@frederickwraps.com',
      subject,
      body,
      attachments: attachments.length > 0 ? attachments : undefined,
    })

    return NextResponse.json({ success: true, messageId: result.id })
  } catch (error: any) {
    console.error('Zayn email error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
