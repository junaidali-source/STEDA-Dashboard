import { NextResponse } from 'next/server'
import { pool, userWhere, filterParams } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const limit = Math.min(Number(sp.get('limit') || 50), 100)
  const p = [...filterParams(req.url), limit]

  try {
    const { rows } = await pool.query(
      `SELECT
        u.id::text,
        COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), 'Unknown') AS name,
        COALESCE(u.school_name, '') AS school_name,
        u.phone_number,
        COALESCE(msg.c, 0)::int AS messages,
        COALESCE(lp.c, 0)::int AS lesson_plans,
        COALESCE(cs.c, 0)::int AS coaching,
        COALESCE(ra.c, 0)::int AS reading,
        COALESCE(vr.c, 0)::int AS video,
        COALESCE(ia.c, 0)::int AS image,
        (
          CASE WHEN COALESCE(lp.c, 0) > 0 THEN 1 ELSE 0 END +
          CASE WHEN COALESCE(cs.c, 0) > 0 THEN 1 ELSE 0 END +
          CASE WHEN COALESCE(ra.c, 0) > 0 THEN 1 ELSE 0 END +
          CASE WHEN COALESCE(vr.c, 0) > 0 THEN 1 ELSE 0 END +
          CASE WHEN COALESCE(ia.c, 0) > 0 THEN 1 ELSE 0 END
        )::int AS features_used,
        (COALESCE(lp.c, 0) + COALESCE(cs.c, 0) + COALESCE(ra.c, 0) + COALESCE(vr.c, 0) + COALESCE(ia.c, 0))::int AS total_actions
      FROM users u
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS c
        FROM conversations c
        WHERE c.user_id = u.id
          AND c.role = 'user'
          AND ($5 = '' OR c.created_at >= $5::timestamptz)
          AND ($6 = '' OR c.created_at <  ($6::date + INTERVAL '1 day')::timestamptz)
      ) msg ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS c
        FROM lesson_plan_requests l
        WHERE l.user_id = u.id
          AND l.status = 'completed'
          AND ($5 = '' OR l.created_at >= $5::timestamptz)
          AND ($6 = '' OR l.created_at <  ($6::date + INTERVAL '1 day')::timestamptz)
      ) lp ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS c
        FROM coaching_sessions c
        WHERE c.user_id = u.id
          AND c.status = 'completed'
          AND ($5 = '' OR c.created_at >= $5::timestamptz)
          AND ($6 = '' OR c.created_at <  ($6::date + INTERVAL '1 day')::timestamptz)
      ) cs ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS c
        FROM reading_assessments r
        WHERE r.user_id = u.id
          AND r.status = 'completed'
          AND ($5 = '' OR r.created_at >= $5::timestamptz)
          AND ($6 = '' OR r.created_at <  ($6::date + INTERVAL '1 day')::timestamptz)
      ) ra ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS c
        FROM video_requests v
        WHERE v.user_id = u.id
          AND v.status = 'completed'
          AND ($5 = '' OR v.created_at >= $5::timestamptz)
          AND ($6 = '' OR v.created_at <  ($6::date + INTERVAL '1 day')::timestamptz)
      ) vr ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS c
        FROM image_analysis_requests i
        WHERE i.user_id = u.id
          AND i.status = 'completed'
          AND ($5 = '' OR i.created_at >= $5::timestamptz)
          AND ($6 = '' OR i.created_at <  ($6::date + INTERVAL '1 day')::timestamptz)
      ) ia ON true
      WHERE ${userWhere('u')}
      ORDER BY total_actions DESC, messages DESC, name ASC
      LIMIT $8`,
      p
    )
    return NextResponse.json(rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

