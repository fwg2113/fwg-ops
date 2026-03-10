import { NextRequest, NextResponse } from 'next/server'

const VALID_ACTIONS = new Set(['analyze-image', 'enhance', 'remove-background', 'vectorize'])
const FORMDATA_ACTIONS = new Set(['analyze-image', 'enhance', 'remove-background'])
const FA_API_BASE = 'https://frederickapparel.com/api/ai'

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mime: string } {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/)
  if (!match) throw new Error('Invalid data URL')
  return { buffer: Buffer.from(match[2], 'base64'), mime: match[1] }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params

  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const targetUrl = `${FA_API_BASE}/${action}`
  console.log(`[image-enhancer] Proxying to: ${targetUrl}`)

  let body: any
  try {
    body = await req.json()
  } catch (err) {
    console.error('[image-enhancer] Failed to parse request body:', err)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    let res: Response

    if (FORMDATA_ACTIONS.has(action)) {
      // FA API expects FormData with a 'file' field for these endpoints
      const { buffer, mime } = dataUrlToBuffer(body.imageBase64)
      const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
      const blob = new Blob([new Uint8Array(buffer)], { type: mime })
      const form = new FormData()
      form.append('file', blob, `upload.${ext}`)
      if (body.background) form.append('background', body.background)

      res = await fetch(targetUrl, { method: 'POST', body: form })
    } else {
      // Vectorize expects JSON with imageBase64 field
      res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: body.imageBase64 }),
      })
    }

    const data = await res.text()
    console.log(`[image-enhancer] ${action} responded with status ${res.status}`)

    if (!res.ok) {
      console.error(`[image-enhancer] ${action} error response:`, data.slice(0, 500))
    }

    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    })
  } catch (err: any) {
    console.error(`[image-enhancer] ${action} fetch failed:`, err)
    return NextResponse.json(
      { error: err.message || 'Proxy request failed', action, targetUrl },
      { status: 500 },
    )
  }
}
