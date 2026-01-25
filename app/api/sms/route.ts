import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { to, message } = await request.json()

  if (!to || !message) {
    return NextResponse.json({ error: 'Missing to or message' }, { status: 400 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
  }

  // Format phone number
  let formattedTo = to.replace(/\D/g, '')
  if (formattedTo.length === 10) {
    formattedTo = '+1' + formattedTo
  } else if (!formattedTo.startsWith('+')) {
    formattedTo = '+' + formattedTo
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: formattedTo,
          From: fromNumber,
          Body: message,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.message || 'Failed to send SMS' }, { status: response.status })
    }

    return NextResponse.json({ success: true, sid: data.sid })
  } catch (error) {
    console.error('SMS Error:', error)
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 })
  }
}
