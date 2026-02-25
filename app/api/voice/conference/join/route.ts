import { NextResponse } from 'next/server'

/**
 * Returns TwiML to join a named conference.
 * Used when redirecting call legs (agent, transfer target) into a conference room.
 *
 * Query params:
 *   conf - Conference friendly name (e.g. "call-CA1234...")
 *   role - "agent" or "target" (controls endConferenceOnExit)
 *   callSid - Parent call SID (for conference events callback)
 *   whisper - Optional message to say before joining
 */
export async function POST(request: Request) {
  const url = new URL(request.url)
  const conf = url.searchParams.get('conf') || 'unknown'
  const role = url.searchParams.get('role') || 'agent'
  const callSid = url.searchParams.get('callSid') || ''
  const whisper = url.searchParams.get('whisper') || ''

  // Agents and targets should NOT end the conference when they leave
  // Only the caller (added via complete/route.ts) has endConferenceOnExit=true
  const endOnExit = 'false'

  const eventsUrl = `https://fwg-ops.vercel.app/api/voice/conference/events?callSid=${callSid}`

  // XML-escape whisper text
  const safeWhisper = whisper.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const whisperTwiml = safeWhisper
    ? `<Say voice="alice">${safeWhisper}</Say>`
    : ''

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${whisperTwiml}
  <Dial>
    <Conference
      startConferenceOnEnter="true"
      endConferenceOnExit="${endOnExit}"
      beep="false"
      statusCallback="${eventsUrl}"
      statusCallbackEvent="join leave end">
      ${conf}
    </Conference>
  </Dial>
</Response>`

  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
}

export async function GET() {
  return new NextResponse('Conference join endpoint active', { status: 200 })
}
