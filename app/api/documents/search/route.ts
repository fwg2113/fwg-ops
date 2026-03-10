import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const isNumber = /^\d+$/.test(q)

  let query = supabase
    .from('documents')
    .select('id, doc_number, doc_type, status, customer_name, company_name, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (isNumber) {
    query = query.eq('doc_number', parseInt(q))
  } else {
    query = query.or(`customer_name.ilike.%${q}%,company_name.ilike.%${q}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('[documents/search] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ results: data || [] })
}
