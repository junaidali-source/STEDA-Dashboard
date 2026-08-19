import { NextResponse } from 'next/server'
import { getTeacherRows } from '@/lib/balochistan-pilot'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const teachers = await getTeacherRows()
    return NextResponse.json({ teachers })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
