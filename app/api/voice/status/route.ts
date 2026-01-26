import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

// Called for each phone that's dialed with status updates
export async function POST(request: Request) {
  const url = new URL(request.url)
  const callSid = url.searchParams.get('callSid')
  
  const formData = await request.formData()
  const callStatus = formData.get('CallStatus') as string
  const to = formData.get('To') as string // The team member's phone
  const duration = formData.get('CallDuration') as string
  
  console.log('Call status update:', { callSid, callStatus, to, duration })

  // If this leg was answered, record who answered
  if (callStatus === 'in-progress' || callStatus === 'answered') {
    // Find team member name
    const { data: teamMember } = await supabase
      .from('call_settings')
      .select('name')
      .eq('phone', to)
      .single()

    if (teamMember) {
      await supabase
        .from('calls')
        .update({
          answered_by: teamMember.name,
          status: 'in-progress'
        })
        .eq('call_sid', callSid)
    }
  }

  // If completed, update duration
  if (callStatus === 'completed' && duration) {
    await supabase
      .from('calls')
      .update({
        status: 'completed',
        duration: parseInt(duration) || 0
      })
      .eq('call_sid', callSid)
  }

  return new NextResponse('OK', { status: 200 })
}

export async function GET() {
  return new NextResponse('Status webhook active', { status: 200 })
}
