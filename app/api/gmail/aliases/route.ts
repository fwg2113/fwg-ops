import { NextResponse } from 'next/server'
import { getGmailAccessToken, getAliases } from '../../../lib/gmail'

export async function GET() {
  const accessToken = await getGmailAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 401 })
  }

  try {
    const aliases = await getAliases(accessToken)

    // Format for frontend
    const formatted = aliases
      .filter((a: any) => a.verificationStatus === 'accepted' || a.isPrimary)
      .map((a: any) => ({
        email: a.sendAsEmail,
        displayName: a.displayName || a.sendAsEmail,
        isPrimary: a.isPrimary || false,
        isDefault: a.isDefault || false,
      }))
      .sort((a: any, b: any) => {
        if (a.isPrimary) return -1
        if (b.isPrimary) return 1
        return a.email.localeCompare(b.email)
      })

    return NextResponse.json({ aliases: formatted })
  } catch (error: any) {
    console.error('Gmail aliases error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
