/**
 * GET /api/suppliers/ss/style/[id]
 *
 * Get detailed product information for a specific SS Activewear style ID
 * including all colors, sizes, and wholesale pricing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ssActivewear } from '@/app/lib/suppliers/ss-activewear'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const styleId = parseInt(params.id)

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
    console.error('Error fetching SS Activewear style:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch style'
      },
      { status: 500 }
    )
  }
}
