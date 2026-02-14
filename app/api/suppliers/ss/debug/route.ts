/**
 * DEBUG: Get raw SS API response to see available fields
 */

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const accountNumber = process.env.SS_ACTIVEWEAR_ACCOUNT_NUMBER || ''
    const apiKey = process.env.SS_ACTIVEWEAR_API_KEY || ''

    if (!accountNumber || !apiKey) {
      return NextResponse.json({ error: 'SS credentials not configured' }, { status: 500 })
    }

    const credentials = Buffer.from(`${accountNumber}:${apiKey}`).toString('base64')
    const baseUrl = process.env.SS_ACTIVEWEAR_BASE_URL || 'https://api.ssactivewear.com/v2'

    // Fetch first few styles to see structure
    const response = await fetch(`${baseUrl}/styles`, {
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

    // Return first 3 items to see structure
    const sample = Array.isArray(data) ? data.slice(0, 3) : data

    return NextResponse.json({
      success: true,
      sampleData: sample,
      firstItemKeys: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [],
      totalCount: Array.isArray(data) ? data.length : 0
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
