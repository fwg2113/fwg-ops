import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Allow login page and static files
  if (
    pathname === '/login' ||
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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}