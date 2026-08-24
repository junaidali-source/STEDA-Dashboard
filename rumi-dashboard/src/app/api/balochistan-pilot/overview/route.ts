import { NextResponse } from 'next/server'
import { getOnboardingBaseline, getActivationTrend, getTrueActivation, ACTIVATION_TARGET_PCT, ACTIVATION_MIN_PCT } from '@/lib/balochistan-pilot'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [baseline, activation, trueActivation] = await Promise.all([
      getOnboardingBaseline(),
      getActivationTrend(),
      getTrueActivation(),
    ])
    return NextResponse.json({
      baseline,
      activation,
      trueActivation,
      targets: { activationTargetPct: ACTIVATION_TARGET_PCT, activationMinPct: ACTIVATION_MIN_PCT },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
