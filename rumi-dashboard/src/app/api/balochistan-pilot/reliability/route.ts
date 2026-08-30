import { NextRequest, NextResponse } from 'next/server'
import { getReliabilityTrend, filtersFromSearchParams } from '@/lib/balochistan-pilot'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const filters = filtersFromSearchParams(req.nextUrl.searchParams)
    const reliability = await getReliabilityTrend(filters)
    return NextResponse.json({ reliability })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
