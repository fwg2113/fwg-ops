import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const VALID_ACTIONS = new Set(['analyze-image', 'enhance', 'remove-background', 'vectorize'])
const FA_API_BASE = 'https://frederickapparel.com/api/ai'

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params

  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const targetUrl = `${FA_API_BASE}/${action}`
  console.log(`[image-enhancer] Proxying to: ${targetUrl}`)

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      body: req.body,
      headers: {
        'Content-Type': req.headers.get('Content-Type') || 'application/octet-stream',
      },
      // @ts-expect-error -- Node fetch supports duplex for streaming request bodies
      duplex: 'half',
    })

    console.log(`[image-enhancer] ${action} responded with status ${res.status}`)

    return new NextResponse(res.body, {
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
