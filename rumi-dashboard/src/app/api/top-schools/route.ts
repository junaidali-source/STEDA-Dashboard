import { NextResponse } from 'next/server'
import { pool, userWhere, dateWhere, filterParams } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sp    = new URL(req.url).searchParams
  const limit = Math.min(Number(sp.get('limit') || 20), 50)
  const p     = [...filterParams(req.url), limit]   // limit = $8

  try {
    const { rows } = await pool.query(
      `SELECT
        u.school_name,
        LEFT(u.phone_number, 2)                                               AS country_code,
        COUNT(DISTINCT u.id)::int                                             AS teachers,
        COUNT(DISTINCT u.id) FILTER (WHERE u.registration_completed)::int     AS registered,
        COUNT(DISTINCT lp.id) FILTER (WHERE lp.status = 'completed')::int     AS lesson_plans,
        COUNT(DISTINCT cs.id) FILTER (WHERE cs.status = 'completed')::int     AS coaching,
        COUNT(DISTINCT ra.id) FILTER (WHERE ra.status = 'completed')::int     AS reading
      FROM users u
      LEFT JOIN lesson_plan_requests lp ON lp.user_id = u.id
      LEFT JOIN coaching_sessions    cs ON cs.user_id = u.id
      LEFT JOIN reading_assessments  ra ON ra.user_id = u.id
      WHERE ${userWhere()} ${dateWhere('u')}
        AND u.school_name IS NOT NULL AND u.school_name <> ''
      GROUP BY u.school_name, LEFT(u.phone_number, 2)
      ORDER BY teachers DESC
      LIMIT $8`,
      p
    )
    return NextResponse.json(rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
