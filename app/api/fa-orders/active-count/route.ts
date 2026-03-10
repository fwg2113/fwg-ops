import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

/**
 * GET /api/fa-orders/active-count
 *
 * Returns count of Frederick Apparel orders (metadata->>'source' = 'frederick-apparel')
 * that are not completed or cancelled. Used for sidebar badge.
 */
export async function GET() {
  try {
    const { count, error } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .filter('metadata->>source', 'eq', 'frederick-apparel')
      .not('status', 'in', '("completed","picked_up","shipped","cancelled")')

    if (error) {
      console.error('Error fetching active FA order count:', error)
      return NextResponse.json({ count: 0 })
    }

    return NextResponse.json({ count: count || 0 })
  } catch (error) {
    console.error('Active FA order count error:', error)
    return NextResponse.json({ count: 0 })
  }
}
