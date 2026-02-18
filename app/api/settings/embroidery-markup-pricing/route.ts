/**
 * GET /api/settings/embroidery-markup-pricing
 * POST /api/settings/embroidery-markup-pricing
 *
 * Manage embroidery markup pricing matrix (quantity breaks and markup percentages)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('apparel_pricing_matrices')
      .select('*')
      .eq('decoration_type', 'embroidery_markup')
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching embroidery markup pricing:', error)
    return NextResponse.json(
      { error: 'Failed to fetch embroidery markup pricing matrix' },
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
    console.error('Error updating embroidery markup pricing:', error)
    return NextResponse.json(
      { error: 'Failed to update embroidery markup pricing matrix' },
      { status: 500 }
    )
  }
}
