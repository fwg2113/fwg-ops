/**
 * GET /api/suppliers/ss/style/[styleId]
 *
 * Get full product details for a specific style including:
 * - All available colors
 * - Sizes and pricing per color
 * - Product images
 * - Description and specifications
 */

import { NextRequest, NextResponse } from 'next/server'
import { ssActivewear } from '@/app/lib/suppliers/ss-activewear'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ styleId: string }> }
) {
  try {
    const { styleId: styleIdParam } = await params
    const styleId = parseInt(styleIdParam, 10)

    if (isNaN(styleId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid style ID'
        },
        { status: 400 }
      )
    }

    const styleDetail = await ssActivewear.getStyleById(styleId)

    if (!styleDetail) {
      return NextResponse.json(
        {
          success: false,
          error: 'Style not found'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: styleDetail
    })
  } catch (error) {
    console.error(`Error fetching style:`, error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch style details'
      },
      { status: 500 }
    )
  }
}
