import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'

const PUBLIC_PREFIXES = ['/login', '/api/auth/', '/api/reports/', '/_next', '/favicon.ico']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()

  const token = request.cookies.get('session')?.value
  if (!token) return NextResponse.redirect(new URL('/login', request.url))

  const session = await verifySessionToken(token)
  if (!session) return NextResponse.redirect(new URL('/login', request.url))

  // STEDA role: only /steda, /coaching and their API routes are allowed
  if (session.role === 'steda' &&
      !pathname.startsWith('/steda') &&
      !pathname.startsWith('/api/steda') &&
      !pathname.startsWith('/coaching') &&
      !pathname.startsWith('/api/coaching')) {
    return NextResponse.redirect(new URL('/steda', request.url))
  }

  // Principal / DEO: only the onboarding tracker and its API route are allowed
  if ((session.role === 'principal' || session.role === 'deo') &&
      !pathname.startsWith('/onboarding-tracker') &&
      !pathname.startsWith('/api/onboarding-tracker')) {
    return NextResponse.redirect(new URL('/onboarding-tracker', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
