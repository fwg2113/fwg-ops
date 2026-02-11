import { supabase } from '@/app/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Count payments not yet confirmed on the sheet
    const { count, error } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('synced_to_sheets', false)

    if (error) {
      return NextResponse.json({ count: 0, error: error.message })
    }

    return NextResponse.json({ count: count || 0 })
  } catch (err: any) {
    return NextResponse.json({ count: 0, error: err.message })
  }
}
