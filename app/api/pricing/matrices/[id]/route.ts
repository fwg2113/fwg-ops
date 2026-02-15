/**
 * GET /api/pricing/matrices/[id]
 *
 * Get a specific pricing matrix by ID.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPricingMatrixById } from '@/app/lib/pricing'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Matrix ID is required'
        },
        { status: 400 }
      )
    }

    const matrix = await getPricingMatrixById(id)

    if (!matrix) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pricing matrix not found'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: matrix
    })
  } catch (error) {
    console.error(`Error fetching pricing matrix ${params.id}:`, error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch pricing matrix'
      },
      { status: 500 }
    )
  }
}
