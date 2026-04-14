import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderSignatureHTML } from '../../lib/signature-template'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const alias = url.searchParams.get('alias')

    const supabase = getSupabase()

    // If alias specified, return the matching signature with rendered HTML (for auto-append)
    if (alias) {
      const { data: byAlias } = await supabase
        .from('team_signatures')
        .select('*')
        .or(`gmail_alias.eq.${alias},email.eq.${alias}`)
        .limit(1)
        .single()

      if (!byAlias) return NextResponse.json({ signature: null })
      return NextResponse.json({
        signature: byAlias,
        html: renderSignatureHTML(byAlias),
      })
    }

    // Otherwise return list
    const { data, error } = await supabase
      .from('team_signatures')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ signatures: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('team_signatures')
      .insert({
        name: body.name,
        title: body.title || '',
        email: body.email,
        gmail_alias: body.gmail_alias || null,
        phone: body.phone || '',
        include_email_in_sig: body.include_email_in_sig ?? false,
        include_address: body.include_address ?? false,
        closing: body.closing || 'Best,',
        show_in_compose: body.show_in_compose ?? true,
        sort_order: body.sort_order ?? 0,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
