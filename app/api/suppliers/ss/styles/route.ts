/**
 * GET /api/suppliers/ss/styles
 *
 * Returns all available styles from SS Activewear catalog.
 * Cached for 1 hour to reduce API calls.
 */

import { NextResponse } from 'next/server'
import { ssActivewear } from '@/app/lib/suppliers/ss-activewear'

export async function GET() {
  try {
    const styles = await ssActivewear.getAllStyles()

    return NextResponse.json({
      success: true,
      data: styles,
      count: styles.length
    })
  } catch (error) {
    console.error('Error fetching SS Activewear styles:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch styles'
      },
      { status: 500 }
    )
  }
}
