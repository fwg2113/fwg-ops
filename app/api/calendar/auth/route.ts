import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json({ 
      error: 'Google Calendar not configured',
      debug: {
        hasClientId: !!clientId,
        hasRedirectUri: !!redirectUri
      }
    }, { status: 500 })
  }

  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar')
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`

  return NextResponse.redirect(authUrl)
}