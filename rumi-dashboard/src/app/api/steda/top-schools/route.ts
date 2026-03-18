import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getSteadaData } from '@/lib/steda-phones'

export async function GET() {
  try {
    const { phones } = getSteadaData()

    const { rows } = await pool.query(
      `WITH steda_users AS (
         SELECT id FROM users
         WHERE phone_number = ANY($1::text[])
           AND COALESCE(is_test_user, false) = false
       )
       SELECT
         u.school_name,
         COUNT(DISTINCT u.id)::int                                              AS teachers,
         COUNT(DISTINCT lp.id) FILTER(WHERE lp.status = 'completed')::int      AS lesson_plans,
         COUNT(DISTINCT cs.id) FILTER(WHERE cs.status = 'completed')::int      AS coaching,
         COUNT(DISTINCT ra.id) FILTER(WHERE ra.status = 'completed')::int      AS reading,
         COUNT(DISTINCT vr.id)::int                                             AS video,
         COUNT(DISTINCT ia.id)::int                                             AS image,
         (
           CASE WHEN COUNT(DISTINCT lp.id) FILTER(WHERE lp.status='completed') > 0 THEN 1 ELSE 0 END +
           CASE WHEN COUNT(DISTINCT cs.id) FILTER(WHERE cs.status='completed') > 0 THEN 1 ELSE 0 END +
           CASE WHEN COUNT(DISTINCT ra.id) FILTER(WHERE ra.status='completed') > 0 THEN 1 ELSE 0 END +
           CASE WHEN COUNT(DISTINCT vr.id) > 0 THEN 1 ELSE 0 END +
           CASE WHEN COUNT(DISTINCT ia.id) > 0 THEN 1 ELSE 0 END
         )::int AS features_active
       FROM users u
       JOIN steda_users su ON u.id = su.id
       LEFT JOIN lesson_plan_requests    lp ON lp.user_id = u.id
       LEFT JOIN coaching_sessions       cs ON cs.user_id = u.id
       LEFT JOIN reading_assessments     ra ON ra.user_id = u.id
       LEFT JOIN video_requests          vr ON vr.user_id = u.id
       LEFT JOIN image_analysis_requests ia ON ia.user_id = u.id
       WHERE u.school_name IS NOT NULL AND u.school_name <> ''
       GROUP BY u.school_name
       ORDER BY features_active DESC, teachers DESC
       LIMIT 20`,
      [phones]
    )

    return NextResponse.json(rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
