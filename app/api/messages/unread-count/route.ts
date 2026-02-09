import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'inbound')
      .eq('read', false)

    if (error) {
      return NextResponse.json({ count: 0, error: error.message })
    }

    return NextResponse.json({ count: count || 0 })
  } catch (err: any) {
    return NextResponse.json({ count: 0, error: err.message })
  }
}
