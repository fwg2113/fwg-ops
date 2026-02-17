/**
 * GET /api/suppliers/sanmar/product/[style]
 *
 * Fetch full product details from SanMar by style number.
 * Returns all colors, sizes, pricing, and images for the given style.
 * Cached for 30 minutes.
 *
 * Example: GET /api/suppliers/sanmar/product/PC61
 * Example: GET /api/suppliers/sanmar/product/G8000
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSanMarClient } from '@/app/lib/suppliers/sanmar'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ style: string }> }
) {
  try {
    const { style } = await params

    if (!style || style.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Style number must be at least 2 characters' },
        { status: 400 }
      )
    }

    const client = getSanMarClient()
    const product = await client.getProductByStyle(style.trim())

    if (!product) {
      return NextResponse.json(
        { success: false, error: `No product found for style "${style}"` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: product,
    })
  } catch (error) {
    console.error('Error fetching SanMar product:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch product',
      },
      { status: 500 }
    )
  }
}
