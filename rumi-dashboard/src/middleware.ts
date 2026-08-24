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

  // STEDA role: only /steda, /coaching, /select-region and their API routes are allowed
  if (session.role === 'steda' &&
      pathname !== '/select-region' &&
      !pathname.startsWith('/steda') &&
      !pathname.startsWith('/api/steda') &&
      !pathname.startsWith('/coaching') &&
      !pathname.startsWith('/api/coaching')) {
    return NextResponse.redirect(new URL('/steda', request.url))
  }

  // Principal / DEO: only the onboarding tracker page, /select-region, and the
  // read-only STEDA data API it embeds (not the /steda admin page itself)
  if ((session.role === 'principal' || session.role === 'deo') &&
      pathname !== '/select-region' &&
      !pathname.startsWith('/onboarding-tracker') &&
      !pathname.startsWith('/api/onboarding-tracker') &&
      !pathname.startsWith('/api/steda')) {
    return NextResponse.redirect(new URL('/onboarding-tracker', request.url))
  }

  // Regional (e.g. Balochistan): only the dedicated pilot dashboard is
  // allowed — no STEDA cohort/CSV panels (no roster yet).
  if (session.role === 'regional' &&
      pathname !== '/balochistan-pilot' &&
      pathname !== '/select-region' &&
      !pathname.startsWith('/api/') ) {
    return NextResponse.redirect(new URL('/balochistan-pilot', request.url))
  }

  // Force every non-admin account onto its assigned region, overriding any
  // client-supplied `?region=` so a locked account can't view another
  // region's data by hand-editing the URL or calling an API route directly.
  if (session.role !== 'admin' && session.region && pathname.startsWith('/api/')) {
    const url = request.nextUrl.clone()
    url.searchParams.set('region', session.region)
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
