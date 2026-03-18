import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getSteadaData } from '@/lib/steda-phones'

export async function GET() {
  try {
    const { phones } = getSteadaData()

    const idsRes = await pool.query(
      `SELECT id FROM users
       WHERE phone_number = ANY($1::text[])
         AND COALESCE(is_test_user, false) = false`,
      [phones]
    )
    const ids: string[] = idsRes.rows.map((r: { id: string }) => r.id)

    if (ids.length === 0) return NextResponse.json([])

    const { rows } = await pool.query(
      `WITH ids AS (SELECT unnest($1::uuid[]) AS id),
       feature_counts AS (
         SELECT u.id,
           (CASE WHEN lp.lp_count IS NOT NULL AND lp.lp_count > 0 THEN 1 ELSE 0 END
          + CASE WHEN cs.cs_count IS NOT NULL AND cs.cs_count > 0 THEN 1 ELSE 0 END
          + CASE WHEN ra.ra_count IS NOT NULL AND ra.ra_count > 0 THEN 1 ELSE 0 END
          + CASE WHEN vr.vr_count IS NOT NULL AND vr.vr_count > 0 THEN 1 ELSE 0 END
          + CASE WHEN ia.ia_count IS NOT NULL AND ia.ia_count > 0 THEN 1 ELSE 0 END
           ) AS feature_count
         FROM ids u
         LEFT JOIN (
           SELECT user_id, COUNT(*) AS lp_count FROM lesson_plan_requests
           WHERE user_id = ANY($1::uuid[]) GROUP BY user_id
         ) lp ON lp.user_id = u.id
         LEFT JOIN (
           SELECT user_id, COUNT(*) AS cs_count FROM coaching_sessions
           WHERE user_id = ANY($1::uuid[]) GROUP BY user_id
         ) cs ON cs.user_id = u.id
         LEFT JOIN (
           SELECT user_id, COUNT(*) AS ra_count FROM reading_assessments
           WHERE user_id = ANY($1::uuid[]) GROUP BY user_id
         ) ra ON ra.user_id = u.id
         LEFT JOIN (
           SELECT user_id, COUNT(*) AS vr_count FROM video_requests
           WHERE user_id = ANY($1::uuid[]) GROUP BY user_id
         ) vr ON vr.user_id = u.id
         LEFT JOIN (
           SELECT user_id, COUNT(*) AS ia_count FROM image_analysis_requests
           WHERE user_id = ANY($1::uuid[]) GROUP BY user_id
         ) ia ON ia.user_id = u.id
       )
       SELECT feature_count,
              CASE feature_count
                WHEN 0 THEN 'No Features Yet'
                WHEN 1 THEN '1 Feature'
                WHEN 2 THEN '2 Features'
                WHEN 3 THEN '3 Features'
                ELSE '4+ Features'
              END AS depth_label,
              COUNT(*)::int AS teachers
       FROM feature_counts
       GROUP BY feature_count
       ORDER BY feature_count`,
      [ids]
    )

    return NextResponse.json(rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
