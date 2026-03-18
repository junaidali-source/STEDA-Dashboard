import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getSteadaData } from '@/lib/steda-phones'

export async function GET() {
  try {
    const { phones, teachers } = getSteadaData()
    const totalListed = teachers.length

    if (phones.length === 0) {
      return NextResponse.json({ error: 'No STEDA phones loaded' }, { status: 500 })
    }

    // Count joined users + get IDs in one query
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
      return NextResponse.json({
        totalListed, totalJoined: 0, totalNotYet: totalListed, anyFeatureUsers: 0,
        lp: empty, coaching: empty, reading: empty, video: empty, image: empty,
      })
    }

    // Run all feature queries in parallel — partner-safe (no latency/queue times)
    const [lpRes, csRes, raRes, vrRes, iaRes, anyRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER(WHERE status='completed')::int AS completed,
                COUNT(DISTINCT user_id)::int AS users
         FROM lesson_plan_requests WHERE user_id = ANY($1::uuid[])`,
        [ids]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER(WHERE status='completed')::int AS completed,
                COUNT(DISTINCT user_id)::int AS users
         FROM coaching_sessions WHERE user_id = ANY($1::uuid[])`,
        [ids]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER(WHERE status='completed')::int AS completed,
                COUNT(DISTINCT user_id)::int AS users
         FROM reading_assessments WHERE user_id = ANY($1::uuid[])`,
        [ids]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER(WHERE status='completed')::int AS completed,
                COUNT(DISTINCT user_id)::int AS users
         FROM video_requests WHERE user_id = ANY($1::uuid[])`,
        [ids]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER(WHERE status='completed')::int AS completed,
                COUNT(DISTINCT user_id)::int AS users
         FROM image_analysis_requests WHERE user_id = ANY($1::uuid[])`,
        [ids]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT user_id)::int AS any_feature_users FROM (
           SELECT user_id FROM lesson_plan_requests    WHERE user_id = ANY($1::uuid[])
           UNION
           SELECT user_id FROM coaching_sessions       WHERE user_id = ANY($1::uuid[])
           UNION
           SELECT user_id FROM reading_assessments     WHERE user_id = ANY($1::uuid[])
           UNION
           SELECT user_id FROM video_requests          WHERE user_id = ANY($1::uuid[])
           UNION
           SELECT user_id FROM image_analysis_requests WHERE user_id = ANY($1::uuid[])
         ) sub`,
        [ids]
      ),
    ])

    function toFeature(row: Record<string, number>) {
      const total     = row.total     ?? 0
      const completed = row.completed ?? 0
      return {
        total,
        completed,
        users: row.users ?? 0,
        completionPct: total > 0 ? Math.round((completed / total) * 100) : 0,
      }
    }

    return NextResponse.json({
      totalListed,
      totalJoined,
      totalNotYet:     totalListed - totalJoined,
      anyFeatureUsers: anyRes.rows[0].any_feature_users ?? 0,
      lp:       toFeature(lpRes.rows[0]),
      coaching: toFeature(csRes.rows[0]),
      reading:  toFeature(raRes.rows[0]),
      video:    toFeature(vrRes.rows[0]),
      image:    toFeature(iaRes.rows[0]),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
