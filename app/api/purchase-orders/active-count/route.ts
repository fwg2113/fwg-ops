import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

/**
 * GET /api/purchase-orders/active-count
 *
 * Returns count of POs in active states (submitted, confirmed, shipped).
 * Used for sidebar badge.
 */
export async function GET() {
  try {
    const { count, error } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['submitted', 'confirmed', 'shipped'])

    if (error) {
      console.error('Error fetching active PO count:', error)
      return NextResponse.json({ count: 0 })
    }

    return NextResponse.json({ count: count || 0 })
  } catch (error) {
    console.error('Active PO count error:', error)
    return NextResponse.json({ count: 0 })
  }
}
