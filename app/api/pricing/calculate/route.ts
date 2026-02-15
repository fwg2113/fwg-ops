/**
 * POST /api/pricing/calculate
 *
 * Calculate pricing for quote line items with:
 * - Quantity break pricing
 * - Decoration costs
 * - Size upcharges
 * - Manual overrides
 *
 * Request Body:
 * {
 *   "lineItems": QuoteLineItem[],
 *   "pricingMatrixId": string (optional)
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { calculateQuote, QuoteLineItem } from '@/app/lib/pricing'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lineItems, pricingMatrixId } = body

    // Validate request
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'lineItems array is required and must not be empty'
        },
        { status: 400 }
      )
    }

    // Validate line items structure
    for (const item of lineItems) {
      if (!item.style_id || !item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Each line item must have style_id and positive quantity'
          },
          { status: 400 }
        )
      }
    }

    // Calculate quote
    const quote = await calculateQuote(
      lineItems as QuoteLineItem[],
      pricingMatrixId
    )

    return NextResponse.json({
      success: true,
      data: quote
    })
  } catch (error) {
    console.error('Error calculating quote:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate quote'
      },
      { status: 500 }
    )
  }
}
