import { NextResponse } from 'next/server'

export async function POST() {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="/api/voice/screen/accept">
    <Say>Incoming call for Frederick Wraps. Press any key to accept.</Say>
  </Gather>
  <Hangup/>
</Response>`
  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
}

export async function GET() {
  return new NextResponse('Screen webhook active', { status: 200 })
}