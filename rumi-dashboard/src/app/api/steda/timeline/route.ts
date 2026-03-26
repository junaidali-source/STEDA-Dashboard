import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getSteadaData } from '@/lib/steda-phones'

export const dynamic = 'force-dynamic'

function batchLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const mar1  = new Date('2026-03-01')
  const mar11 = new Date('2026-03-11')
  const mar13 = new Date('2026-03-13')
  if (d < mar1)  return 'Feb 2026'
  if (d < mar11) return 'Other Mar'
  if (d < mar13) return 'Mar 11–12'
  return 'Mar 13–16'
}

export async function GET(req: NextRequest) {
  try {
    const sp   = new URL(req.url).searchParams
    const from = sp.get('from') || null
    const to   = sp.get('to')   || null

    const { phones } = getSteadaData()
    const res = await pool.query(
      `SELECT DATE_TRUNC('day', created_at)::date::text AS day, COUNT(*)::int AS count
       FROM users
       WHERE phone_number = ANY($1::text[])
         AND COALESCE(is_test_user, false) = false
         AND ($2::date IS NULL OR created_at::date >= $2::date)
         AND ($3::date IS NULL OR created_at::date <= $3::date)
       GROUP BY 1 ORDER BY 1`,
      [phones, from, to]
    )
    return NextResponse.json(res.rows.map((r: { day: string; count: number }) => ({
      day: r.day, count: r.count, batch: batchLabel(r.day),
    })))
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
