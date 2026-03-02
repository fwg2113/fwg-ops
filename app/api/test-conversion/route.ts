import { NextResponse } from 'next/server'
import { uploadClickConversion } from '@/app/lib/googleAdsConversion'

/**
 * GET /api/test-conversion
 *
 * Quick test endpoint to verify the Google Ads offline conversion upload.
 * Uses a fake gclid so it won't create a real conversion, but you can
 * inspect the raw API response to confirm auth + request shape are correct.
 *
 * Pass ?gclid=XXXXX to test with a specific gclid.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gclid = searchParams.get('gclid') || 'test_click_id_12345'
  const conversionTime = new Date()

  const result = await uploadClickConversion(gclid, conversionTime)

  return NextResponse.json({
    test: true,
    gclid,
    conversion_time: conversionTime.toISOString(),
    result,
  })
}
