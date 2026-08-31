import { NextRequest, NextResponse } from 'next/server'
import { getNpsSummary, filtersFromSearchParams, PILOT_END_ESTIMATE } from '@/lib/balochistan-pilot'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const filters = filtersFromSearchParams(req.nextUrl.searchParams)
    const nps = await getNpsSummary(filters)
    return NextResponse.json({ nps, pilotEndEstimate: PILOT_END_ESTIMATE })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
