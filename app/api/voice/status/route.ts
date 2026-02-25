import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// Called for each phone that's dialed with status updates
export async function POST(request: Request) {
  const url = new URL(request.url)
  const callSid = url.searchParams.get('callSid')
  
  const formData = await request.formData()
  const callStatus = formData.get('CallStatus') as string
  const childCallSid = formData.get('CallSid') as string // This child leg's SID
  const to = formData.get('To') as string // The team member's phone
  const duration = formData.get('CallDuration') as string

  console.log('Call status update:', { callSid, childCallSid, callStatus, to, duration })

  // If this leg was answered, record who answered and their call SID (for warm transfer)
  if (callStatus === 'in-progress' || callStatus === 'answered') {
    // Find team member name - try phone first, then SIP URI
    let teamMember: { name: string } | null = null

    if (to?.startsWith('sip:')) {
      const { data } = await supabase
        .from('call_settings')
        .select('name')
        .eq('sip_uri', to)
        .single()
      teamMember = data
    }

    if (!teamMember && to) {
      const { data } = await supabase
        .from('call_settings')
        .select('name')
        .eq('phone', to)
        .single()
      teamMember = data
    }

    // Also try matching by client identity (browser-based calls)
    if (!teamMember && to?.startsWith('client:')) {
      // Browser client — just mark the call as in-progress
      await supabase
        .from('calls')
        .update({
          answered_by: 'Dashboard',
          agent_call_sid: childCallSid,
          status: 'in-progress'
        })
        .eq('call_sid', callSid)
    } else if (teamMember) {
      await supabase
        .from('calls')
        .update({
          answered_by: teamMember.name,
          agent_call_sid: childCallSid,
          status: 'in-progress'
        })
        .eq('call_sid', callSid)
    } else if (to) {
      // Unknown target but still answered — mark in-progress
      await supabase
        .from('calls')
        .update({
          agent_call_sid: childCallSid,
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
