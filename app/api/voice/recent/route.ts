import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

/**
 * Returns recent calls (last 10) for the phone widget call history.
 * Includes customer name lookups.
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('calls')
      .select('id, call_sid, direction, caller_phone, receiver_phone, answered_by, status, duration, category, created_at')
      .in('status', ['completed', 'missed', 'in-progress', 'voicemail'])
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Recent calls query error:', error)
      return NextResponse.json({ calls: [] })
    }

    // Look up customer names
    const calls = await Promise.all(
      (data || []).map(async (call) => {
        const phone = call.direction === 'inbound' ? call.caller_phone : call.receiver_phone
        const cleanPhone = (phone || '').replace(/\D/g, '')
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

        return { ...call, customer_name: customerName, phone }
      })
    )

    return NextResponse.json({ calls })
  } catch (error) {
    console.error('Recent calls error:', error)
    return NextResponse.json({ calls: [] })
  }
}
