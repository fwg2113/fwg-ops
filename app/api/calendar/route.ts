import { NextResponse } from 'next/server'
import { supabase } from '../../lib/supabase'

async function getValidAccessToken() {
  const { data: settings } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'google_calendar_tokens')
    .single()

  if (!settings?.value) {
    return null
  }

  const tokens = JSON.parse(settings.value)
  
  // Check if token is expired (with 5 min buffer)
  if (Date.now() > tokens.expiry_date - 300000) {
    // Refresh the token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    const newTokens = await response.json()
    
    if (newTokens.access_token) {
      const updatedTokens = {
        access_token: newTokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: Date.now() + (newTokens.expires_in * 1000)
      }
      
      await supabase.from('settings').upsert({
        key: 'google_calendar_tokens',
        value: JSON.stringify(updatedTokens)
      }, { onConflict: 'key' })
      
      return newTokens.access_token
    }
    return null
  }

  return tokens.access_token
}

export async function POST(request: Request) {
  const { title, description, startTime, endTime, customerName, customerPhone } = await request.json()

  const accessToken = await getValidAccessToken()
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Calendar not connected. Please connect in Settings.' }, { status: 401 })
  }

  const calendarId = 'primary'
  
  const event = {
    summary: title,
    description: `${description || ''}\n\nCustomer: ${customerName || 'N/A'}\nPhone: ${customerPhone || 'N/A'}`,
    start: {
      dateTime: startTime,
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: endTime,
      timeZone: 'America/New_York',
    },
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Calendar API error:', data)
      return NextResponse.json({ error: data.error?.message || 'Failed to create event' }, { status: 400 })
    }

    return NextResponse.json({ success: true, eventId: data.id, htmlLink: data.htmlLink })
  } catch (error) {
    console.error('Calendar error:', error)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}

export async function GET() {
  const accessToken = await getValidAccessToken()
  
  if (!accessToken) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({ connected: true })
}