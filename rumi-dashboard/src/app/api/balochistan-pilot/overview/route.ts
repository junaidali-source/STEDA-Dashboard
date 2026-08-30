import { NextRequest, NextResponse } from 'next/server'
import { getOnboardingBaseline, getActivationTrend, filtersFromSearchParams, ACTIVATION_TARGET_PCT, ACTIVATION_MIN_PCT } from '@/lib/balochistan-pilot'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const filters = filtersFromSearchParams(req.nextUrl.searchParams)
    const [baseline, activation] = await Promise.all([
      getOnboardingBaseline(filters),
      getActivationTrend(filters),
    ])
    return NextResponse.json({
      baseline,
      activation,
      targets: { activationTargetPct: ACTIVATION_TARGET_PCT, activationMinPct: ACTIVATION_MIN_PCT },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
