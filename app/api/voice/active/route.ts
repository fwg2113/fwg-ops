import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

/**
 * Returns currently active (in-progress) calls.
 * Used by the PhoneWidget and mobile transfer page to show transfer controls
 * for calls answered on any device (not just the browser).
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('calls')
      .select('call_sid, caller_phone, receiver_phone, answered_by, agent_call_sid, category, transfer_status, transfer_target_phone, transfer_target_name, conference_sid, conference_name, created_at')
      .eq('status', 'in-progress')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('Active calls query error:', error)
      return NextResponse.json({ calls: [] })
    }

    // Look up customer names for each caller
    const calls = await Promise.all(
      (data || []).map(async (call) => {
        const cleanPhone = (call.caller_phone || '').replace(/\D/g, '')
        let customerName = null

        if (cleanPhone) {
          const { data: match } = await supabase
            .from('customer_phones')
            .select('customers(name)')
            .or(`phone.ilike.%${cleanPhone.slice(-10)}%`)
            .limit(1)

          if (match && match.length > 0 && match[0].customers) {
            customerName = (match[0].customers as any).name
          }
        }

        return { ...call, customer_name: customerName }
      })
    )

    return NextResponse.json({ calls })
  } catch (error) {
    console.error('Active calls error:', error)
    return NextResponse.json({ calls: [] })
  }
}
