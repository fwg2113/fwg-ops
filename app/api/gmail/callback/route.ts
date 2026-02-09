import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fwg-ops.vercel.app'

  if (error) {
    return NextResponse.redirect(`${baseUrl}/settings?error=gmail_denied`)
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/settings?error=no_code`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_GMAIL_REDIRECT_URI

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri!,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenResponse.json()

    if (tokens.error) {
      console.error('Gmail token error:', tokens)
      return NextResponse.redirect(`${baseUrl}/settings?error=gmail_token_failed`)
    }

    await supabase.from('settings').upsert({
      key: 'google_gmail_tokens',
      value: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: Date.now() + (tokens.expires_in * 1000)
      })
    }, { onConflict: 'key' })

    return NextResponse.redirect(`${baseUrl}/settings?success=gmail_connected`)
  } catch (err) {
    console.error('Gmail auth error:', err)
    return NextResponse.redirect(`${baseUrl}/settings?error=gmail_auth_failed`)
  }
}