import { supabase } from '@/app/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { paymentIds } = body

    if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      return NextResponse.json({ error: 'paymentIds array required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('payments')
      .update({ read: true })
      .in('id', paymentIds)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
