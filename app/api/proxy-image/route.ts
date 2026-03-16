import { NextRequest } from 'next/server'

const ALLOWED_DOMAINS = [
  'cdnm.sanmar.com',
  'www.ssactivewear.com',
  'ssactivewear.com',
]

// Also allow R2 public bucket domains
const ALLOWED_DOMAIN_SUFFIXES = [
  '.r2.dev',
]

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return new Response('Missing url parameter', { status: 400 })
  }

  try {
    const parsed = new URL(url)
    const domainAllowed = ALLOWED_DOMAINS.includes(parsed.hostname) ||
      ALLOWED_DOMAIN_SUFFIXES.some(suffix => parsed.hostname.endsWith(suffix))
    if (!domainAllowed) {
      return new Response('Domain not allowed', { status: 403 })
    }

    const response = await fetch(url)
    if (!response.ok) {
      return new Response('Failed to fetch image', { status: response.status })
    }

    const buffer = await response.arrayBuffer()
    return new Response(buffer, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new Response('Failed to proxy image', { status: 500 })
  }
}
