import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getSteadaData } from '@/lib/steda-phones'

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

export async function GET() {
  try {
    const { phones } = getSteadaData()

    const res = await pool.query(
      `SELECT DATE_TRUNC('day', created_at)::date::text AS day,
              COUNT(*)::int AS count
       FROM users
       WHERE phone_number = ANY($1::text[])
         AND COALESCE(is_test_user, false) = false
       GROUP BY 1
       ORDER BY 1`,
      [phones]
    )

    const rows = res.rows.map((r: { day: string; count: number }) => ({
      day:   r.day,
      count: r.count,
      batch: batchLabel(r.day),
    }))

    return NextResponse.json(rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
