import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getFilteredStedaPhones, getFilteredStedaTeachers, stedaScopeFromSearchParams } from '@/lib/steda-scope'

export const dynamic = 'force-dynamic'

function toFeature(row: Record<string, number>) {
  const total = row.total ?? 0
  const completed = row.completed ?? 0
  return { total, completed, users: row.users ?? 0, completionPct: total > 0 ? Math.round((completed / total) * 100) : 0 }
}

export async function GET(req: NextRequest) {
  try {
    const sp   = new URL(req.url).searchParams
    const from = sp.get('from') || null   // YYYY-MM-DD
    const to   = sp.get('to')   || null

    const { region, district } = stedaScopeFromSearchParams(sp)
    const phones = await getFilteredStedaPhones(region, district)
    const teachers = await getFilteredStedaTeachers(region, district)
    const totalListed = teachers.length
    if (phones.length === 0) {
      const empty = { total: 0, completed: 0, users: 0, completionPct: 0 }
      return NextResponse.json({
        totalListed: 0, totalJoined: 0, totalNotYet: 0, anyFeatureUsers: 0,
        lp: empty, coaching: empty, reading: empty, video: empty, image: empty,
      })
    }

    const joinedRes = await pool.query(
      `SELECT id, COUNT(*) OVER()::int AS total_joined
       FROM users
       WHERE phone_number = ANY($1::text[])
         AND COALESCE(is_test_user, false) = false`,
      [phones]
    )
    const totalJoined = joinedRes.rows[0]?.total_joined ?? 0
    const ids: string[] = joinedRes.rows.map((r: { id: string }) => r.id)

    if (ids.length === 0) {
      const empty = { total: 0, completed: 0, users: 0, completionPct: 0 }
      return NextResponse.json({ totalListed, totalJoined: 0, totalNotYet: totalListed, anyFeatureUsers: 0, lp: empty, coaching: empty, reading: empty, video: empty, image: empty })
    }

    const dateCond = `AND ($2::date IS NULL OR created_at::date >= $2::date)
                      AND ($3::date IS NULL OR created_at::date <= $3::date)`
    const p = [ids, from, to]

    const [lpRes, csRes, raRes, vrRes, iaRes, anyRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER(WHERE status='completed')::int AS completed, COUNT(DISTINCT user_id)::int AS users FROM lesson_plan_requests    WHERE user_id = ANY($1::uuid[]) ${dateCond}`, p),
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER(WHERE status='completed')::int AS completed, COUNT(DISTINCT user_id)::int AS users FROM coaching_sessions       WHERE user_id = ANY($1::uuid[]) ${dateCond}`, p),
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER(WHERE status='completed')::int AS completed, COUNT(DISTINCT user_id)::int AS users FROM reading_assessments     WHERE user_id = ANY($1::uuid[]) ${dateCond}`, p),
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER(WHERE status='completed')::int AS completed, COUNT(DISTINCT user_id)::int AS users FROM video_requests          WHERE user_id = ANY($1::uuid[]) ${dateCond}`, p),
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER(WHERE status='completed')::int AS completed, COUNT(DISTINCT user_id)::int AS users FROM image_analysis_requests WHERE user_id = ANY($1::uuid[]) ${dateCond}`, p),
      pool.query(
        `SELECT COUNT(DISTINCT user_id)::int AS any_feature_users FROM (
           SELECT user_id FROM lesson_plan_requests    WHERE user_id = ANY($1::uuid[]) ${dateCond}
           UNION
           SELECT user_id FROM coaching_sessions       WHERE user_id = ANY($1::uuid[]) ${dateCond}
           UNION
           SELECT user_id FROM reading_assessments     WHERE user_id = ANY($1::uuid[]) ${dateCond}
           UNION
           SELECT user_id FROM video_requests          WHERE user_id = ANY($1::uuid[]) ${dateCond}
           UNION
           SELECT user_id FROM image_analysis_requests WHERE user_id = ANY($1::uuid[]) ${dateCond}
         ) sub`, p
      ),
    ])

    return NextResponse.json({
      totalListed, totalJoined, totalNotYet: totalListed - totalJoined,
      anyFeatureUsers: anyRes.rows[0].any_feature_users ?? 0,
      lp: toFeature(lpRes.rows[0]), coaching: toFeature(csRes.rows[0]),
      reading: toFeature(raRes.rows[0]), video: toFeature(vrRes.rows[0]),
      image: toFeature(iaRes.rows[0]),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
