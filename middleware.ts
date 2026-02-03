import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // Portal domain - only allow customer-facing routes
  if (hostname.startsWith('portal.')) {
    if (
      pathname.startsWith('/view') ||
      pathname.startsWith('/payment-success') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon')
    ) {
      return NextResponse.next()
    }
    // Redirect everything else to a not-found or back to view
    return NextResponse.redirect(new URL('/view/not-found', request.url))
  }

  // Ops domain and all others - require auth
  // Allow public routes
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

  // Check for auth cookie
  const authCookie = request.cookies.get('fwg_auth')

  if (!authCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
