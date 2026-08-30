import { NextRequest, NextResponse } from 'next/server'
import { getTeacherRows, filtersFromSearchParams } from '@/lib/balochistan-pilot'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const filters = filtersFromSearchParams(req.nextUrl.searchParams)
    const teachers = await getTeacherRows(filters)
    return NextResponse.json({ teachers })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
