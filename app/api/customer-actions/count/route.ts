import { supabase } from '@/app/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('customer_actions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'TODO')

    if (error) {
      return NextResponse.json({ count: 0, error: error.message })
    }

    return NextResponse.json({ count: count || 0 })
  } catch (err: any) {
    return NextResponse.json({ count: 0, error: err.message })
  }
}
