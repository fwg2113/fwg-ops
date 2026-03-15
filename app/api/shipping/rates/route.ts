import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const SHIP_FROM = {
  name: 'Frederick Wraps',
  street1: '5726 Industry Ln Suite I',
  city: 'Frederick',
  state: 'MD',
  zip: '21704',
  country: 'US',
  phone: '2405757562',
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { document_id, parcel } = body

  if (!document_id || !parcel) {
    return NextResponse.json({ error: 'document_id and parcel required' }, { status: 400 })
  }

  const { length, width, height, weight } = parcel
  if (!length || !width || !height || !weight) {
    return NextResponse.json({ error: 'parcel needs length, width, height, weight' }, { status: 400 })
  }

  const apiKey = process.env.EASYPOST_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'EasyPost not configured' }, { status: 500 })
  }

  // Fetch document for shipping address
  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .select('customer_name, fulfillment_details')
    .eq('id', document_id)
    .single()

  if (docErr || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const rawAddr = doc.fulfillment_details?.shipping_address
  if (!rawAddr) {
    return NextResponse.json({ error: 'No shipping address on document. Set fulfillment details first.' }, { status: 400 })
  }
  // Support both structured address object and legacy plain string
  const shipTo = typeof rawAddr === 'string'
    ? { street1: rawAddr, city: '', state: '', zip: '' }
    : rawAddr
  if (!shipTo.street1 || !shipTo.city || !shipTo.state || !shipTo.zip) {
    return NextResponse.json({ error: 'Incomplete shipping address. Please fill in street, city, state, and ZIP in fulfillment details.' }, { status: 400 })
  }

  try {
    const shipmentRes = await fetch('https://api.easypost.com/v2/shipments', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shipment: {
          from_address: SHIP_FROM,
          to_address: {
            name: shipTo.name || doc.customer_name,
            street1: shipTo.street1,
            street2: shipTo.street2 || '',
            city: shipTo.city,
            state: shipTo.state,
            zip: shipTo.zip,
            country: shipTo.country || 'US',
            phone: shipTo.phone || '',
          },
          parcel: {
            length: Number(length),
            width: Number(width),
            height: Number(height),
            weight: Number(weight), // in oz
          },
        },
      }),
    })

    const shipment = await shipmentRes.json()

    if (!shipmentRes.ok) {
      console.error('EasyPost error:', shipment)
      return NextResponse.json({ error: shipment.error?.message || 'EasyPost error' }, { status: 400 })
    }

    // Sort rates by price
    const rates = (shipment.rates || [])
      .map((r: any) => ({
        id: r.id,
        carrier: r.carrier,
        service: r.service,
        rate: r.rate,
        currency: r.currency,
        delivery_days: r.delivery_days,
        est_delivery_date: r.est_delivery_date,
      }))
      .sort((a: any, b: any) => Number(a.rate) - Number(b.rate))

    return NextResponse.json({
      success: true,
      shipment_id: shipment.id,
      rates,
    })
  } catch (e) {
    console.error('EasyPost rates error:', e)
    return NextResponse.json({ error: 'Failed to get shipping rates' }, { status: 500 })
  }
}
