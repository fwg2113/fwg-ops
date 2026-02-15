/**
 * DEBUG: Get raw SS products API response
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ styleId: string }> }
) {
  try {
    const { styleId: styleIdParam } = await params
    const styleId = parseInt(styleIdParam, 10)

    if (isNaN(styleId)) {
      return NextResponse.json({ error: 'Invalid style ID' }, { status: 400 })
    }

    const accountNumber = process.env.SS_ACTIVEWEAR_ACCOUNT_NUMBER || ''
    const apiKey = process.env.SS_ACTIVEWEAR_API_KEY || ''

    if (!accountNumber || !apiKey) {
      return NextResponse.json({ error: 'SS credentials not configured' }, { status: 500 })
    }

    const credentials = Buffer.from(`${accountNumber}:${apiKey}`).toString('base64')
    const baseUrl = process.env.SS_ACTIVEWEAR_BASE_URL || 'https://api.ssactivewear.com/v2'

    // Try products endpoint
    const response = await fetch(`${baseUrl}/products/${styleId}`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return NextResponse.json({
        error: `SS API error: ${response.status}`,
        text: await response.text()
      }, { status: response.status })
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      rawData: data,
      dataType: typeof data,
      isArray: Array.isArray(data),
      keys: Array.isArray(data)
        ? `array[${data.length}]`
        : (typeof data === 'object' ? Object.keys(data) : 'N/A'),
      firstItem: Array.isArray(data) && data.length > 0 ? data[0] : null
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
