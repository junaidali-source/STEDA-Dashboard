import { NextResponse } from 'next/server'
import { getSchoolCohortRollups } from '@/lib/balochistan-pilot'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await getSchoolCohortRollups()
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
