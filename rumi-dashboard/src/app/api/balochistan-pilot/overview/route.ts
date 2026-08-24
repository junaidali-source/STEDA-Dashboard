import { NextResponse } from 'next/server'
import { getOnboardingBaseline, getActivationTrend, ACTIVATION_TARGET_PCT, ACTIVATION_MIN_PCT } from '@/lib/balochistan-pilot'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [baseline, activation] = await Promise.all([
      getOnboardingBaseline(),
      getActivationTrend(),
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
