import { NextRequest, NextResponse } from 'next/server'
import { getRetentionSummary, getDropOffTeachers, filtersFromSearchParams, DROP_OFF_DAYS } from '@/lib/balochistan-pilot'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const filters = filtersFromSearchParams(req.nextUrl.searchParams)
    const [retention, dropOff] = await Promise.all([
      getRetentionSummary(filters),
      getDropOffTeachers(filters),
    ])
    return NextResponse.json({ retention, dropOff, dropOffDays: DROP_OFF_DAYS })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
