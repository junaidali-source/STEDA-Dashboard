import { NextResponse } from 'next/server'
import { getNpsSummary, PILOT_END_ESTIMATE } from '@/lib/balochistan-pilot'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const nps = await getNpsSummary()
    return NextResponse.json({ nps, pilotEndEstimate: PILOT_END_ESTIMATE })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
