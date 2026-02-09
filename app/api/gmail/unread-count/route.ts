import { NextResponse } from 'next/server'
import { getGmailClient } from '@/app/lib/gmail'

export async function GET() {
  try {
    const gmail = await getGmailClient()

    // Use labels.get for INBOX which includes unread count directly
    const res = await gmail.users.labels.get({
      userId: 'me',
      id: 'INBOX',
    })

    const count = res.data.threadsUnread || 0

    return NextResponse.json({ count })
  } catch (err: any) {
    console.error('Gmail unread count error:', err.message)
    return NextResponse.json({ count: 0, error: err.message })
  }
}
