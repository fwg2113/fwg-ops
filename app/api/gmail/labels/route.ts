import { NextResponse } from 'next/server'
import { getGmailAccessToken } from '../../../lib/gmail'

export async function GET() {
  const accessToken = await getGmailAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 401 })
  }

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.error?.message || 'Failed to fetch labels' }, { status: res.status })
    }

    const data = await res.json()

    // Map label objects: { id, name, type, ... }
    const labels = (data.labels || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      type: l.type, // 'system' or 'user'
      color: l.color?.backgroundColor || null,
      textColor: l.color?.textColor || null,
    }))

    return NextResponse.json({ labels })
  } catch (error: any) {
    console.error('Gmail labels error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
