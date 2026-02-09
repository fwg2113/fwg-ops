import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_GMAIL_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Gmail not configured' }, { status: 500 })
  }

  const scopes = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send'
  ]

  const scope = encodeURIComponent(scopes.join(' '))
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`

  return NextResponse.redirect(authUrl)
}