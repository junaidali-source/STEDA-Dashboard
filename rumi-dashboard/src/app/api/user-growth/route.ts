import { NextResponse } from 'next/server'
import { pool, userWhere, filterParams } from '@/lib/db'

export async function GET(req: Request) {
  const p = filterParams(req.url)
  try {
    const { rows } = await pool.query(
      `SELECT
        TO_CHAR(DATE_TRUNC('month', u.created_at), 'YYYY-MM') AS month,
        COUNT(*)::int                                           AS new_users,
        COUNT(*) FILTER (WHERE u.registration_completed)::int  AS registered
      FROM users u
      WHERE ${userWhere()}
        AND u.created_at >= CASE
          WHEN $5 = '' THEN NOW() - INTERVAL '12 months'
          ELSE $5::timestamptz
        END
        AND ($6 = '' OR u.created_at < ($6::date + INTERVAL '1 day')::timestamptz)
      GROUP BY DATE_TRUNC('month', u.created_at)
      ORDER BY DATE_TRUNC('month', u.created_at)`,
      p
    )
    return NextResponse.json(rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
