import { NextResponse } from 'next/server'
import twilio from 'twilio'

const AccessToken = twilio.jwt.AccessToken
const VoiceGrant = AccessToken.VoiceGrant

export async function POST(request: Request) {
  try {
    const { identity } = await request.json()

    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const apiKey = process.env.TWILIO_API_KEY!
    const apiSecret = process.env.TWILIO_API_SECRET!
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID!

    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      return NextResponse.json(
        { error: 'Twilio browser calling not configured' },
        { status: 500 }
      )
    }

    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: identity || 'ops-dashboard',
      ttl: 3600
    })

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true
    })

    token.addGrant(voiceGrant)

    return NextResponse.json({ token: token.toJwt() })
  } catch (error) {
    console.error('Token generation error:', error)
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
  }
}
