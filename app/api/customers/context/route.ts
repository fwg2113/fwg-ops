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
    const email = url.searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Look up customer by email
    const { data: customer } = await supabase
      .from('customers')
      .select('id, email, phone, first_name, last_name, display_name, company, lifetime_value, created_at')
      .eq('email', email.toLowerCase())
      .single()

    if (!customer) {
      return NextResponse.json({ customer: null, documents: [], recentPayments: [] })
    }

    // Get their documents (quotes + invoices), most recent first
    const { data: documents } = await supabase
      .from('documents')
      .select('id, doc_number, doc_type, status, total, amount_paid, balance_due, created_at, category, project_description, vehicle_description')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(20)

    // Get recent payments across all their documents
    const docIds = (documents || []).map(d => d.id)
    let recentPayments: any[] = []
    if (docIds.length > 0) {
      const { data: payments } = await supabase
        .from('payments')
        .select('id, document_id, amount, payment_method, status, created_at')
        .in('document_id', docIds)
        .order('created_at', { ascending: false })
        .limit(10)
      recentPayments = payments || []
    }

    return NextResponse.json({
      customer,
      documents: documents || [],
      recentPayments,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
