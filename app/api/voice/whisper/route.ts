import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const category = url.searchParams.get('category') || 'Incoming call'

    // This TwiML plays to the team member who answers, before they're connected to the caller
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${category} call.</Say>
</Response>`

    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (error) {
    console.error('Whisper error:', error)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }
}

export async function GET() {
  return new NextResponse('Whisper webhook active', { status: 200 })
}
