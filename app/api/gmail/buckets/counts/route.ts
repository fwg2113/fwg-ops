import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET() {
  try {
    const supabase = getSupabase()

    // Get counts per bucket
    const { data: threads, error } = await supabase
      .from('email_threads')
      .select('bucket, follow_up_tier')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const counts: Record<string, number> = {
      need_to_respond: 0,
      responded: 0,
      waiting_on_task: 0,
      follow_up: 0,
      archived: 0,
    }

    const followUpTiers: Record<string, number> = {
      '2_3_days': 0,
      '6_8_days': 0,
      '10_14_days': 0,
      '1_3_months': 0,
      '3_plus_months': 0,
    }

    for (const thread of threads || []) {
      if (thread.bucket in counts) {
        counts[thread.bucket]++
      }
      if (thread.bucket === 'follow_up' && thread.follow_up_tier) {
        if (thread.follow_up_tier in followUpTiers) {
          followUpTiers[thread.follow_up_tier]++
        }
      }
    }

    return NextResponse.json({ counts, followUpTiers })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
