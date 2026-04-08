import { NextResponse } from 'next/server'
import { getSteadaData } from '@/lib/steda-phones'
import { PK_REGION_OPTIONS } from '@/lib/pk-regions'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { districtListed } = getSteadaData()
    const districts = Object.keys(districtListed).sort((a, b) => a.localeCompare(b))
    return NextResponse.json({ regions: PK_REGION_OPTIONS, districts })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
