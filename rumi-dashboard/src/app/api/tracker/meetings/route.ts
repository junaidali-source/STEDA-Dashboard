import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await pool.query(`
      SELECT mm.*,
        COUNT(ai.id)::int                                         AS action_count,
        COUNT(ai.id) FILTER(WHERE ai.status='open')::int          AS open_count
      FROM meeting_minutes mm
      LEFT JOIN action_items ai ON ai.meeting_id = mm.id
      GROUP BY mm.id
      ORDER BY mm.meeting_date DESC
    `)
    return NextResponse.json(res.rows)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
