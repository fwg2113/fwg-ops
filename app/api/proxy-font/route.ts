import { NextRequest } from 'next/server'

// Disable Next.js fetch caching for this route
export const dynamic = 'force-dynamic'

// Proxy Google Fonts to get TTF format for opentype.js (which can't parse WOFF2).
export async function GET(request: NextRequest) {
  const family = request.nextUrl.searchParams.get('family')
  const weight = request.nextUrl.searchParams.get('weight') || '400'

  if (!family) {
    return new Response('Missing family parameter', { status: 400 })
  }

  try {
    // Use CSS v1 API with a non-browser user-agent to get TTF URLs
    const cssUrl = `https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}:${weight}`
    const cssRes = await fetch(cssUrl, {
      cache: 'no-store',
      headers: { 'User-Agent': 'curl/8.0' }
    })
    const cssText = await cssRes.text()
    console.log('[proxy-font] CSS response:', cssText.substring(0, 300))

    // Extract the .ttf URL
    const urlMatch = cssText.match(/url\(([^)]+\.ttf)\)/)
    if (!urlMatch) {
      // Try any URL as fallback
      const anyMatch = cssText.match(/url\(([^)]+)\)/)
      if (!anyMatch) {
        return new Response(`No font URL found. CSS: ${cssText.substring(0, 300)}`, { status: 404 })
      }
      console.log('[proxy-font] No .ttf URL, using fallback:', anyMatch[1])
    }

    const fontUrl = urlMatch?.[1] || cssText.match(/url\(([^)]+)\)/)?.[1]
    if (!fontUrl) {
      return new Response('No font URL found', { status: 404 })
    }

    console.log('[proxy-font] Fetching font from:', fontUrl)
    const fontRes = await fetch(fontUrl, { cache: 'no-store' })
    if (!fontRes.ok) {
      return new Response(`Failed to fetch font: ${fontRes.status}`, { status: fontRes.status })
    }

    const buffer = await fontRes.arrayBuffer()
    const view = new Uint8Array(buffer)
    const sig = String.fromCharCode(view[0], view[1], view[2], view[3])
    console.log('[proxy-font] Font signature:', sig, 'Size:', buffer.byteLength)

    if (sig === 'wOFF' || sig === 'wOF2') {
      return new Response(`Font is ${sig} format, not TTF. URL: ${fontUrl}`, { status: 500 })
    }

    return new Response(buffer, {
      headers: {
        'Content-Type': 'font/ttf',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    return new Response(`Failed to proxy font: ${err}`, { status: 500 })
  }
}
