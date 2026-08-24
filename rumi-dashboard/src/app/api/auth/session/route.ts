import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const token = cookies().get('session')?.value

  if (!token) {
    return NextResponse.json({ error: 'No session' }, { status: 401 })
  }

  const session = await verifySessionToken(token)
  if (!session) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  return NextResponse.json(session)
}
