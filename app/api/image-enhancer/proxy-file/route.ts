import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/image-enhancer/proxy-file?url=...
 *
 * Proxies a file download from R2 to avoid CORS issues when the browser
 * needs to fetch an R2-hosted file (e.g., loading a project file in the Mockup Builder).
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'url parameter required' }, { status: 400 })
  }

  // Only allow fetching from our R2 public URL
  const r2PublicUrl = process.env.R2_PUBLIC_URL || ''
  if (!url.startsWith(r2PublicUrl)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 })
  }

  try {
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream fetch failed (${res.status})` }, { status: res.status })
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    const body = await res.arrayBuffer()

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
