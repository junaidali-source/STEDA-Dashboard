import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'

const PUBLIC_PREFIXES = ['/login', '/api/auth/', '/_next', '/favicon.ico']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()

  const token = request.cookies.get('session')?.value
  if (!token) return NextResponse.redirect(new URL('/login', request.url))

  const session = await verifySessionToken(token)
  if (!session) return NextResponse.redirect(new URL('/login', request.url))

  // STEDA role: only /steda and /api/steda/* are allowed
  if (session.role === 'steda' && !pathname.startsWith('/steda') && !pathname.startsWith('/api/steda')) {
    return NextResponse.redirect(new URL('/steda', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
