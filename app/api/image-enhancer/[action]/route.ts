import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FORMDATA_ACTIONS = new Set(['analyze-image', 'enhance', 'remove-background'])
const JSON_ACTIONS = new Set(['vectorize'])
const FA_API_BASE = 'https://frederickapparel.com/api/ai'

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params

  if (!FORMDATA_ACTIONS.has(action) && !JSON_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const targetUrl = `${FA_API_BASE}/${action}`
  console.log(`[image-enhancer] Proxying to: ${targetUrl}`)

  try {
    let faRes: Response

    if (FORMDATA_ACTIONS.has(action)) {
      // Expect JSON body with { fileUrl, background? }
      const body = await req.json()
      const { fileUrl, background } = body

      if (!fileUrl) {
        return NextResponse.json({ error: 'fileUrl is required' }, { status: 400 })
      }

      // Fetch the file from R2
      console.log(`[image-enhancer] Fetching file from R2: ${fileUrl}`)
      const fileRes = await fetch(fileUrl)
      if (!fileRes.ok) {
        return NextResponse.json({ error: `Failed to fetch file from R2 (${fileRes.status})` }, { status: 502 })
      }

      const blob = await fileRes.blob()
      const filename = fileUrl.split('/').pop() || 'upload.png'

      // Build FormData for FA API
      const form = new FormData()
      form.append('file', blob, filename)
      if (background) form.append('background', background)

      faRes = await fetch(targetUrl, { method: 'POST', body: form })
    } else {
      // Vectorize: forward JSON body as-is
      const body = await req.text()
      faRes = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    }

    console.log(`[image-enhancer] ${action} responded with status ${faRes.status}`)

    return new NextResponse(faRes.body, {
      status: faRes.status,
      headers: { 'Content-Type': faRes.headers.get('Content-Type') || 'application/json' },
    })
  } catch (err: any) {
    console.error(`[image-enhancer] ${action} fetch failed:`, err)
    return NextResponse.json(
      { error: err.message || 'Proxy request failed', action, targetUrl },
      { status: 500 },
    )
  }
}
