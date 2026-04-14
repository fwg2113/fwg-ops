import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
export function proxy(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl
  // Hands subdomain - rewrite to /hands route, no auth required
  if (hostname.includes('hands')) {
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      pathname.startsWith('/api')
    ) {
      return NextResponse.next()
    }
    if (pathname === '/' || pathname === '') {
      return NextResponse.rewrite(new URL('/hands', request.url))
    }
    if (pathname.startsWith('/hands')) {
      return NextResponse.next()
    }
    return NextResponse.rewrite(new URL('/hands', request.url))
  }
  // Portal domain - only allow customer-facing routes
  if (hostname.includes('portal')) {
    if (
      pathname.startsWith('/view') ||
      pathname.startsWith('/payment-success') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon')
    ) {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL('/view/not-found', request.url))
  }
  // Ops domain and all others - require auth
  // Landing pages are public (no auth needed)
  if (
    pathname === '/login' ||
    pathname.startsWith('/view') ||
    pathname.startsWith('/payment-success') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/commercial-vehicle-wraps') ||
    pathname.startsWith('/vehicle-lettering-graphics') ||
    pathname.startsWith('/fleet-wraps') ||
    pathname.startsWith('/get-quote') ||
    pathname.startsWith('/thank-you') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/images')
  ) {
    return NextResponse.next()
  }
  const authCookie = request.cookies.get('fwg_auth')
  if (!authCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
