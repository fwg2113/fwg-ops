import { NextResponse } from 'next/server'

/**
 * GET /api/fa-orders/active-count
 *
 * FA Orders don't need a sidebar badge count.
 */
export async function GET() {
  return NextResponse.json({ count: 0 })
}
