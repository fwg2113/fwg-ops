/**
 * GET /api/suppliers/sanmar/inventory/[style]
 *
 * Fetch real-time warehouse-level inventory from SanMar.
 * Returns inventory quantities per warehouse for each color/size combo.
 * Cached for 5 minutes.
 *
 * Example: GET /api/suppliers/sanmar/inventory/PC61
 * Example: GET /api/suppliers/sanmar/inventory/PC61?color=White&size=L
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSanMarClient } from '@/app/lib/suppliers/sanmar'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ style: string }> }
) {
  try {
    const { style } = await params
    const searchParams = request.nextUrl.searchParams
    const color = searchParams.get('color') || undefined
    const size = searchParams.get('size') || undefined

    if (!style || style.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Style number must be at least 2 characters' },
        { status: 400 }
      )
    }

    const client = getSanMarClient()
    const inventory = await client.getInventory(style.trim(), color, size)

    if (!inventory) {
      return NextResponse.json(
        { success: false, error: `No inventory data found for style "${style}"` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: inventory,
    })
  } catch (error) {
    console.error('Error fetching SanMar inventory:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch inventory',
      },
      { status: 500 }
    )
  }
}
