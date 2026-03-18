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
       feature_stats AS (
         SELECT 'Lesson Plans'         AS feature, 1 AS sort_order,
                COUNT(DISTINCT user_id)::int AS users,
                COUNT(*)::int AS requests,
                COUNT(*) FILTER(WHERE status='completed')::int AS completed
         FROM lesson_plan_requests WHERE user_id = ANY($1::uuid[])
         UNION ALL
         SELECT 'Coaching Sessions',   2,
                COUNT(DISTINCT user_id)::int,
                COUNT(*)::int,
                COUNT(*) FILTER(WHERE status='completed')::int
         FROM coaching_sessions WHERE user_id = ANY($1::uuid[])
         UNION ALL
         SELECT 'Reading Assessments', 3,
                COUNT(DISTINCT user_id)::int,
                COUNT(*)::int,
                COUNT(*) FILTER(WHERE status='completed')::int
         FROM reading_assessments WHERE user_id = ANY($1::uuid[])
         UNION ALL
         SELECT 'Video Generation',    4,
                COUNT(DISTINCT user_id)::int,
                COUNT(*)::int,
                COUNT(*) FILTER(WHERE status='completed')::int
         FROM video_requests WHERE user_id = ANY($1::uuid[])
         UNION ALL
         SELECT 'Image Analysis',      5,
                COUNT(DISTINCT user_id)::int,
                COUNT(*)::int,
                COUNT(*) FILTER(WHERE status='completed')::int
         FROM image_analysis_requests WHERE user_id = ANY($1::uuid[])
       )
       SELECT feature, users, requests, completed,
              CASE WHEN requests > 0
                   THEN ROUND((completed::numeric / requests) * 100, 1)
                   ELSE 0 END AS completion_pct
       FROM feature_stats
       ORDER BY sort_order`,
      [ids]
    )

    return NextResponse.json(rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
