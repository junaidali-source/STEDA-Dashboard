import { NextRequest, NextResponse } from 'next/server'
import { getTeacherDetail } from '@/lib/balochistan-pilot'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { phone: string } }) {
  try {
    const detail = await getTeacherDetail(params.phone)
    return NextResponse.json(detail)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
