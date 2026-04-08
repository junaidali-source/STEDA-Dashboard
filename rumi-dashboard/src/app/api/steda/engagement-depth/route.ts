import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getFilteredStedaPhones, stedaScopeFromSearchParams } from '@/lib/steda-scope'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sp   = new URL(req.url).searchParams
    const from = sp.get('from') || null
    const to   = sp.get('to')   || null

    const { region, district } = stedaScopeFromSearchParams(sp)
    const phones = await getFilteredStedaPhones(region, district)
    const idsRes = await pool.query(
      `SELECT id FROM users WHERE phone_number = ANY($1::text[]) AND COALESCE(is_test_user, false) = false`,
      [phones]
    )
    const ids: string[] = idsRes.rows.map((r: { id: string }) => r.id)
    if (ids.length === 0) return NextResponse.json([])

    const dc = `AND ($2::date IS NULL OR created_at::date >= $2::date) AND ($3::date IS NULL OR created_at::date <= $3::date)`
    const p  = [ids, from, to]

    const { rows } = await pool.query(
      `WITH ids AS (SELECT unnest($1::uuid[]) AS id),
       feature_counts AS (
         SELECT u.id,
           (CASE WHEN lp.c > 0 THEN 1 ELSE 0 END + CASE WHEN cs.c > 0 THEN 1 ELSE 0 END +
            CASE WHEN ra.c > 0 THEN 1 ELSE 0 END + CASE WHEN vr.c > 0 THEN 1 ELSE 0 END +
            CASE WHEN ia.c > 0 THEN 1 ELSE 0 END) AS feature_count
         FROM ids u
         LEFT JOIN (SELECT user_id, COUNT(*) AS c FROM lesson_plan_requests    WHERE user_id = ANY($1::uuid[]) ${dc} GROUP BY user_id) lp ON lp.user_id=u.id
         LEFT JOIN (SELECT user_id, COUNT(*) AS c FROM coaching_sessions       WHERE user_id = ANY($1::uuid[]) ${dc} GROUP BY user_id) cs ON cs.user_id=u.id
         LEFT JOIN (SELECT user_id, COUNT(*) AS c FROM reading_assessments     WHERE user_id = ANY($1::uuid[]) ${dc} GROUP BY user_id) ra ON ra.user_id=u.id
         LEFT JOIN (SELECT user_id, COUNT(*) AS c FROM video_requests          WHERE user_id = ANY($1::uuid[]) ${dc} GROUP BY user_id) vr ON vr.user_id=u.id
         LEFT JOIN (SELECT user_id, COUNT(*) AS c FROM image_analysis_requests WHERE user_id = ANY($1::uuid[]) ${dc} GROUP BY user_id) ia ON ia.user_id=u.id
       )
       SELECT feature_count,
              CASE feature_count WHEN 0 THEN 'No Features Yet' WHEN 1 THEN '1 Feature'
                WHEN 2 THEN '2 Features' WHEN 3 THEN '3 Features' ELSE '4+ Features' END AS depth_label,
              COUNT(*)::int AS teachers
       FROM feature_counts GROUP BY feature_count ORDER BY feature_count`, p
    )
    return NextResponse.json(rows)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
