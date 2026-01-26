import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const callSid = url.searchParams.get('callSid')
    
    const formData = await request.formData()
    const dialCallStatus = formData.get('DialCallStatus') as string
    const dialCallDuration = formData.get('DialCallDuration') as string

    console.log('Call complete:', { callSid, dialCallStatus, dialCallDuration })

    const duration = parseInt(dialCallDuration) || 0
    
    if (duration > 0 || dialCallStatus === 'completed' || dialCallStatus === 'answered') {
      await supabase
        .from('calls')
        .update({
          status: 'completed',
          duration: duration
        })
        .eq('call_sid', callSid)

      return new NextResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    await supabase
      .from('calls')
      .update({ status: 'missed' })
      .eq('call_sid', callSid)

    const from = url.searchParams.get('from')
    const twiml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Say voice=\"alice\">No one is available. Please leave a message after the beep.</Say><Record maxLength=\"120\" action=\"/api/voice/voicemail?callSid=" + callSid + "&from=" + encodeURIComponent(from || "") + "\" /></Response>"

    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (error) {
    console.error('Complete webhook error:', error)
    return new NextResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
      headers: { 'Content-Type': 'text/xml' }
    })
  }
}

export async function GET() {
  return new NextResponse('Complete webhook active', { status: 200 })
}
