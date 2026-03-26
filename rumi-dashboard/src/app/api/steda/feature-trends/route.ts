import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getSteadaData } from '@/lib/steda-phones'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sp   = new URL(req.url).searchParams
    const from = sp.get('from') || null
    const to   = sp.get('to')   || null

    const { phones } = getSteadaData()
    const idsRes = await pool.query(
      `SELECT id FROM users WHERE phone_number = ANY($1::text[]) AND COALESCE(is_test_user, false) = false`,
      [phones]
    )
    const ids: string[] = idsRes.rows.map((r: { id: string }) => r.id)
    if (ids.length === 0) return NextResponse.json([])

    const dc = `AND ($2::date IS NULL OR created_at::date >= $2::date) AND ($3::date IS NULL OR created_at::date <= $3::date)`
    const p  = [ids, from, to]

    const { rows } = await pool.query(
      `WITH
       lp AS (SELECT DATE_TRUNC('day',created_at)::date::text AS day, COUNT(*)::int AS cnt FROM lesson_plan_requests    WHERE user_id = ANY($1::uuid[]) ${dc} GROUP BY 1),
       cs AS (SELECT DATE_TRUNC('day',created_at)::date::text AS day, COUNT(*)::int AS cnt FROM coaching_sessions       WHERE user_id = ANY($1::uuid[]) ${dc} GROUP BY 1),
       ra AS (SELECT DATE_TRUNC('day',created_at)::date::text AS day, COUNT(*)::int AS cnt FROM reading_assessments     WHERE user_id = ANY($1::uuid[]) ${dc} GROUP BY 1),
       vr AS (SELECT DATE_TRUNC('day',created_at)::date::text AS day, COUNT(*)::int AS cnt FROM video_requests          WHERE user_id = ANY($1::uuid[]) ${dc} GROUP BY 1),
       ia AS (SELECT DATE_TRUNC('day',created_at)::date::text AS day, COUNT(*)::int AS cnt FROM image_analysis_requests WHERE user_id = ANY($1::uuid[]) ${dc} GROUP BY 1),
       all_days AS (SELECT day FROM lp UNION SELECT day FROM cs UNION SELECT day FROM ra UNION SELECT day FROM vr UNION SELECT day FROM ia)
       SELECT d.day,
              COALESCE(lp.cnt,0) AS lesson_plans, COALESCE(cs.cnt,0) AS coaching,
              COALESCE(ra.cnt,0) AS reading,       COALESCE(vr.cnt,0) AS video,
              COALESCE(ia.cnt,0) AS image
       FROM all_days d
       LEFT JOIN lp ON lp.day=d.day LEFT JOIN cs ON cs.day=d.day LEFT JOIN ra ON ra.day=d.day
       LEFT JOIN vr ON vr.day=d.day LEFT JOIN ia ON ia.day=d.day
       ORDER BY d.day`, p
    )
    return NextResponse.json(rows)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
