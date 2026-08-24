import { NextResponse } from 'next/server'
import { getReliabilityTrend } from '@/lib/balochistan-pilot'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const reliability = await getReliabilityTrend()
    return NextResponse.json({ reliability })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
