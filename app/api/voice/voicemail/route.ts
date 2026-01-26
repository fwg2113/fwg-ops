import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

// Called after voicemail recording is complete
export async function POST(request: Request) {
  const url = new URL(request.url)
  const callSid = url.searchParams.get('callSid')
  const from = url.searchParams.get('from')
  const customerName = url.searchParams.get('customerName')
  
  const formData = await request.formData()
  const recordingUrl = formData.get('RecordingUrl') as string
  const recordingDuration = formData.get('RecordingDuration') as string
  const transcriptionText = formData.get('TranscriptionText') as string
  
  console.log('Voicemail received:', { callSid, recordingUrl, recordingDuration })

  // Update call record with voicemail info
  await supabase
    .from('calls')
    .update({
      status: 'voicemail',
      voicemail_url: recordingUrl ? `${recordingUrl}.mp3` : null,
      duration: parseInt(recordingDuration) || 0
    })
    .eq('call_sid', callSid)

  // Optionally create a message with transcription
  if (transcriptionText && from) {
    await supabase.from('messages').insert({
      direction: 'inbound',
      channel: 'voicemail',
      customer_phone: from,
      customer_name: customerName || null,
      message_body: `📞 Voicemail: ${transcriptionText}`,
      status: 'received',
      read: false
    })
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for your message. We'll get back to you shortly. Goodbye.</Say>
  <Hangup />
</Response>`

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' }
  })
}

export async function GET() {
  return new NextResponse('Voicemail webhook active', { status: 200 })
}
