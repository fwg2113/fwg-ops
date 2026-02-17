/**
 * GET /api/settings/qty-tiers
 * POST /api/settings/qty-tiers
 *
 * Manage universal quantity tier ranges across all pricing matrices.
 * GET returns the current tier ranges (from the first matrix found).
 * POST updates the min/max ranges on ALL matrices, preserving each matrix's
 * markup_pct and decoration_prices per tier.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'

export async function GET() {
  try {
    const { data: matrices, error } = await supabase
      .from('apparel_pricing_matrices')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    if (!matrices || matrices.length === 0) {
      return NextResponse.json({ tiers: [], matrices: [] })
    }

    // Use the first matrix's quantity_breaks as the canonical tier ranges
    const canonical = matrices[0].quantity_breaks || []
    const tiers = canonical.map((qb: any) => ({ min: qb.min, max: qb.max }))

    return NextResponse.json({ tiers, matrices })
  } catch (error) {
    console.error('Error fetching qty tiers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch qty tiers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tiers } = body as { tiers: { min: number; max: number }[] }

    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid tiers array' },
        { status: 400 }
      )
    }

    // Fetch all existing pricing matrices
    const { data: matrices, error: fetchErr } = await supabase
      .from('apparel_pricing_matrices')
      .select('*')

    if (fetchErr) throw fetchErr
    if (!matrices || matrices.length === 0) {
      return NextResponse.json(
        { error: 'No pricing matrices found' },
        { status: 404 }
      )
    }

    // Update each matrix's quantity_breaks with new tier ranges
    const updates = matrices.map(matrix => {
      const existingBreaks = matrix.quantity_breaks || []
      const newBreaks = tiers.map((tier, idx) => {
        // Preserve existing markup_pct and decoration_prices if the tier index exists
        const existing = existingBreaks[idx] || {}
        return {
          min: tier.min,
          max: tier.max,
          markup_pct: existing.markup_pct ?? 200,
          decoration_prices: existing.decoration_prices ?? {}
        }
      })

      return supabase
        .from('apparel_pricing_matrices')
        .update({
          quantity_breaks: newBreaks,
          updated_at: new Date().toISOString()
        })
        .eq('id', matrix.id)
    })

    await Promise.all(updates)

    return NextResponse.json({ success: true, updatedCount: matrices.length })
  } catch (error) {
    console.error('Error updating qty tiers:', error)
    return NextResponse.json(
      { error: 'Failed to update qty tiers' },
      { status: 500 }
    )
  }
}
