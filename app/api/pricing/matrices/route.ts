/**
 * GET /api/pricing/matrices
 *
 * Get all pricing matrices from the database.
 * Returns decoration types, quantity breaks, and size upcharges.
 */

import { NextResponse } from 'next/server'
import { getAllPricingMatrices } from '@/app/lib/pricing'

export async function GET() {
  try {
    const matrices = await getAllPricingMatrices()

    return NextResponse.json({
      success: true,
      data: matrices,
      count: matrices.length
    })
  } catch (error) {
    console.error('Error fetching pricing matrices:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch pricing matrices'
      },
      { status: 500 }
    )
  }
}
