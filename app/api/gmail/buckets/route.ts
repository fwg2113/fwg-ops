import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const bucket = url.searchParams.get('bucket') || 'need_to_respond'
    const followUpTier = url.searchParams.get('followUpTier')
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50')
    const offset = (page - 1) * pageSize

    const supabase = getSupabase()

    let query = supabase
      .from('email_threads')
      .select('*', { count: 'exact' })
      .eq('bucket', bucket)
      .order('last_message_date', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (bucket === 'follow_up' && followUpTier) {
      query = query.eq('follow_up_tier', followUpTier)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      threads: data || [],
      total: count || 0,
      bucket,
      page,
      pageSize,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
