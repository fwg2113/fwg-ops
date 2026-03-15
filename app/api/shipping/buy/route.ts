import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { document_id, shipment_id, rate_id } = body

  if (!document_id || !shipment_id || !rate_id) {
    return NextResponse.json({ error: 'document_id, shipment_id, and rate_id required' }, { status: 400 })
  }

  const apiKey = process.env.EASYPOST_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'EasyPost not configured' }, { status: 500 })
  }

  try {
    const buyRes = await fetch(`https://api.easypost.com/v2/shipments/${shipment_id}/buy`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rate: { id: rate_id } }),
    })

    const result = await buyRes.json()

    if (!buyRes.ok) {
      console.error('EasyPost buy error:', result)
      return NextResponse.json({ error: result.error?.message || 'Failed to buy label' }, { status: 400 })
    }

    const trackingNumber = result.tracking_code
    const labelUrl = result.postage_label?.label_url

    // Save to document
    await supabase
      .from('documents')
      .update({
        tracking_number: trackingNumber,
        shipping_label_url: labelUrl,
        easypost_shipment_id: shipment_id,
        shipped: true,
        status: 'shipped',
      })
      .eq('id', document_id)

    return NextResponse.json({
      success: true,
      tracking_number: trackingNumber,
      label_url: labelUrl,
    })
  } catch (e) {
    console.error('EasyPost buy error:', e)
    return NextResponse.json({ error: 'Failed to purchase label' }, { status: 500 })
  }
}
