import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

/**
 * Initiate an outbound call from Twilio to connect team member to customer
 * Process:
 * 1. Call the first enabled team member's phone
 * 2. When they answer, connect them to the customer
 * 3. Customer sees business number as caller ID
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { to, customerName, documentId } = body

    if (!to) {
      return NextResponse.json({ error: 'Customer phone number required' }, { status: 400 })
    }

    // Get Twilio credentials
    const twilioSid = process.env.TWILIO_ACCOUNT_SID
    const twilioToken = process.env.TWILIO_AUTH_TOKEN
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER

    if (!twilioSid || !twilioToken || !twilioNumber) {
      return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
    }

    // Get the first enabled team member's phone
    const { data: teamPhones } = await supabase
      .from('call_settings')
      .select('phone, name')
      .eq('enabled', true)
      .order('ring_order', { ascending: true })
      .limit(1)

    if (!teamPhones || teamPhones.length === 0) {
      return NextResponse.json({ error: 'No team phone configured' }, { status: 500 })
    }

    const teamPhone = teamPhones[0].phone

    // TwiML to connect to customer after team member answers
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you to ${customerName}.</Say>
  <Dial callerId="${twilioNumber}">
    <Number>${to}</Number>
  </Dial>
</Response>`

    // Initiate call to team member
    const callResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: teamPhone,
          From: twilioNumber,
          Twiml: twiml
        })
      }
    )

    const callData = await callResponse.json()

    if (!callResponse.ok) {
      console.error('Twilio error:', callData)
      return NextResponse.json({ error: callData.message || 'Failed to initiate call' }, { status: 500 })
    }

    // Log the call
    await supabase.from('calls').insert({
      direction: 'outbound',
      caller_phone: teamPhone,
      receiver_phone: to,
      status: 'initiated',
      call_sid: callData.sid,
      document_id: documentId || null
    })

    return NextResponse.json({
      success: true,
      callSid: callData.sid,
      message: 'Call initiated successfully'
    })
  } catch (error: any) {
    console.error('Error initiating call:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
