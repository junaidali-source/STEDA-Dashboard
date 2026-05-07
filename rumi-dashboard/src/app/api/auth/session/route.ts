import { NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie')
  if (!cookie) {
    return NextResponse.json({ error: 'No session' }, { status: 401 })
  }

  const match = cookie.match(/session=([^;]+)/)
  const token = match ? match[1] : null

  if (!token) {
    return NextResponse.json({ error: 'No session' }, { status: 401 })
  }

  const session = await verifySessionToken(token)
  if (!session) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  return NextResponse.json(session)
}
