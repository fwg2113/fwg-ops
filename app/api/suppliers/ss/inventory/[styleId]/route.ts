/**
 * GET /api/suppliers/ss/inventory/[styleId]
 *
 * Get real-time inventory data for a specific style.
 * Returns inventory levels by warehouse for each color/size combination.
 * Cached for 5 minutes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ssActivewear } from '@/app/lib/suppliers/ss-activewear'

export async function GET(
  request: NextRequest,
  { params }: { params: { styleId: string } }
) {
  try {
    const styleId = parseInt(params.styleId, 10)

    if (isNaN(styleId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid style ID'
        },
        { status: 400 }
      )
    }

    const inventory = await ssActivewear.getInventoryByStyleId(styleId)

    return NextResponse.json({
      success: true,
      data: inventory,
      styleId: styleId
    })
  } catch (error) {
    console.error(`Error fetching inventory for style ${params.styleId}:`, error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch inventory'
      },
      { status: 500 }
    )
  }
}
