import { NextRequest, NextResponse } from 'next/server'
import { getEngagementTrend, getCoachingScoreTrend, filtersFromSearchParams, LP_WEEKLY_TARGET_PCT } from '@/lib/balochistan-pilot'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const filters = filtersFromSearchParams(req.nextUrl.searchParams)
    const [engagement, coachingScores] = await Promise.all([
      getEngagementTrend(filters),
      getCoachingScoreTrend(filters),
    ])
    return NextResponse.json({ engagement, coachingScores, lpWeeklyTargetPct: LP_WEEKLY_TARGET_PCT })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
