/**
 * GET /api/suppliers/ss/search?q={query}
 *
 * Search SS Activewear products by style number, brand, or keyword.
 * Returns up to 20 matching results.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ssActivewear } from '@/app/lib/suppliers/ss-activewear'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Search query must be at least 2 characters'
        },
        { status: 400 }
      )
    }

    const results = await ssActivewear.searchStyles(query)

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
      query: query
    })
  } catch (error) {
    console.error('Error searching SS Activewear products:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      },
      { status: 500 }
    )
  }
}
