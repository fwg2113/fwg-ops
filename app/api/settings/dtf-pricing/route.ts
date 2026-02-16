/**
 * GET /api/settings/dtf-pricing
 * POST /api/settings/dtf-pricing
 *
 * Manage DTF apparel pricing matrix (quantity breaks and markup percentages)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('apparel_pricing_matrices')
      .select('*')
      .eq('decoration_type', 'dtf')
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching DTF pricing:', error)
    return NextResponse.json(
      { error: 'Failed to fetch DTF pricing matrix' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, quantity_breaks } = body

    if (!id || !quantity_breaks) {
      return NextResponse.json(
        { error: 'Missing required fields: id, quantity_breaks' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('apparel_pricing_matrices')
      .update({
        quantity_breaks,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error updating DTF pricing:', error)
    return NextResponse.json(
      { error: 'Failed to update DTF pricing matrix' },
      { status: 500 }
    )
  }
}
