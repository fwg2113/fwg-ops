import { NextResponse } from 'next/server'
import { getGmailAccessToken } from '@/app/lib/gmail'

export async function GET() {
  try {
    const accessToken = await getGmailAccessToken()

    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    const data = await res.json()
    const count = data.threadsUnread || 0

    return NextResponse.json({ count })
  } catch (err: any) {
    console.error('Gmail unread count error:', err.message)
    return NextResponse.json({ count: 0, error: err.message })
  }
}