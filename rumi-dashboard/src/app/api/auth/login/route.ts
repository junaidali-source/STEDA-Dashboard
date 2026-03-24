import { NextRequest, NextResponse } from 'next/server'
import { validateCredentials, createSessionToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const { username, password } = await request.json()
  const result = validateCredentials(username, password)
  if (!result) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })

  const token = await createSessionToken(username, result.role)
  const res   = NextResponse.json({ role: result.role })
  res.cookies.set('session', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7,
    path:     '/',
  })
  return res
}
