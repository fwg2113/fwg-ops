import { NextResponse } from 'next/server'
import { getGmailAccessToken, sendEmail } from '../../../lib/gmail'

export async function POST(request: Request) {
  const accessToken = await getGmailAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 401 })
  }

  try {
    const { to, from, subject, body, threadId, inReplyTo, references, cc, bcc } = await request.json()

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 })
    }

    const result = await sendEmail(accessToken, {
      to,
      from: from || 'info@frederickwraps.com',
      subject,
      body,
      threadId,
      inReplyTo,
      references,
      cc,
      bcc,
    })

    return NextResponse.json({ success: true, messageId: result.id, threadId: result.threadId })
  } catch (error: any) {
    console.error('Gmail send error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
