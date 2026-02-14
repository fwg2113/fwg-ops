/**
 * DEBUG: Try SS products API with query param
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const styleId = request.nextUrl.searchParams.get('styleId')

    if (!styleId) {
      return NextResponse.json({ error: 'Missing styleId param' }, { status: 400 })
    }

    const accountNumber = process.env.SS_ACTIVEWEAR_ACCOUNT_NUMBER || ''
    const apiKey = process.env.SS_ACTIVEWEAR_API_KEY || ''

    if (!accountNumber || !apiKey) {
      return NextResponse.json({ error: 'SS credentials not configured' }, { status: 500 })
    }

    const credentials = Buffer.from(`${accountNumber}:${apiKey}`).toString('base64')
    const baseUrl = process.env.SS_ACTIVEWEAR_BASE_URL || 'https://api.ssactivewear.com/v2'

    // Try with query param
    const response = await fetch(`${baseUrl}/products?styleId=${styleId}`, {
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
      endpoint: `/products?styleId=${styleId}`,
      rawData: data,
      dataType: typeof data,
      isArray: Array.isArray(data),
      count: Array.isArray(data) ? data.length : 'N/A'
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
