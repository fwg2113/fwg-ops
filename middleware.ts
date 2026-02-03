import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl

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
  if (
    pathname === '/login' ||
    pathname.startsWith('/view') ||
    pathname.startsWith('/payment-success') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
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