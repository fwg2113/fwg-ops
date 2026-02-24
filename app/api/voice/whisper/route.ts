import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const category = url.searchParams.get('category') || 'Incoming call'

    // XML-escape to prevent invalid TwiML (e.g. "Stickers & Signage" → "Stickers &amp; Signage")
    const safeCategory = category.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    // This TwiML plays to the team member who answers, before they're connected to the caller
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${safeCategory} call.</Say>
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
