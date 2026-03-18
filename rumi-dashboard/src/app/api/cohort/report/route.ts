import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

// Reusable CTE block — params: $1=week_start, $2=country, $3=partner
function cohortCTE(): string {
  return `
    cohort AS (
      SELECT u.id, u.registration_completed, u.phone_number,
        LEFT(u.phone_number, 2) AS cc
      FROM users u
      WHERE COALESCE(u.is_test_user, false) = false
        AND u.created_at >= $1::date
        AND u.created_at <  ($1::date + INTERVAL '7 days')
        AND ($2 = 'all' OR LEFT(u.phone_number, 2) = $2)
        AND ($3 = '' OR u.phone_number IN (
          SELECT jsonb_array_elements_text(scope_value->'phone_numbers')
          FROM access_scopes
          WHERE dashboard_user_id = $3::uuid AND scope_type = 'phone_list'
        ))
    ),
    msg_counts AS (
      SELECT cv.user_id,
        COUNT(*)                           AS msg_count,
        COUNT(DISTINCT cv.created_at::date) AS active_days
      FROM conversations cv
      WHERE cv.user_id IN (SELECT id FROM cohort) AND cv.role = 'user'
      GROUP BY cv.user_id
    )
  `
}

export async function GET(req: Request) {
  const sp      = new URL(req.url).searchParams
  const week    = sp.get('week')    || ''
  const country = sp.get('country') || 'all'
  const partner = sp.get('partner') || ''

  if (!week) {
    return NextResponse.json({ error: 'week param required (YYYY-MM-DD)' }, { status: 400 })
  }

  const params = [week, country, partner]

  try {
    const [summaryRes, bucketsRes, countriesRes] = await Promise.all([
      // ── Query 1: Summary + behavior comparison ──
      pool.query(
        `WITH ${cohortCTE()}
        SELECT
          COUNT(*)::int                                                               AS total_users,
          COUNT(*) FILTER (WHERE registration_completed)::int                        AS registered,
          ROUND(
            (100.0 * COUNT(*) FILTER (WHERE registration_completed) / NULLIF(COUNT(*),0))::numeric, 1
          )                                                                           AS reg_rate,
          COUNT(*) FILTER (WHERE COALESCE(mc.msg_count,0) >= 1)::int                AS sent_1_plus,
          COUNT(*) FILTER (WHERE COALESCE(mc.msg_count,0) >= 10)::int               AS sent_10_plus,
          -- registered group
          ROUND(AVG(CASE WHEN registration_completed THEN mc.msg_count  END)::numeric,1)  AS reg_avg_messages,
          ROUND(AVG(CASE WHEN registration_completed THEN mc.active_days END)::numeric,1) AS reg_avg_days,
          ROUND((100.0 * COUNT(*) FILTER (WHERE registration_completed AND EXISTS(
            SELECT 1 FROM lesson_plan_requests l WHERE l.user_id=cohort.id AND l.status='completed'
          )) / NULLIF(COUNT(*) FILTER (WHERE registration_completed),0))::numeric,1)     AS reg_lp_pct,
          ROUND((100.0 * COUNT(*) FILTER (WHERE registration_completed AND EXISTS(
            SELECT 1 FROM coaching_sessions cs WHERE cs.user_id=cohort.id AND cs.status='completed'
          )) / NULLIF(COUNT(*) FILTER (WHERE registration_completed),0))::numeric,1)     AS reg_cs_pct,
          ROUND((100.0 * COUNT(*) FILTER (WHERE registration_completed AND EXISTS(
            SELECT 1 FROM reading_assessments ra WHERE ra.user_id=cohort.id AND ra.status='completed'
          )) / NULLIF(COUNT(*) FILTER (WHERE registration_completed),0))::numeric,1)     AS reg_ra_pct,
          -- unregistered group
          ROUND(AVG(CASE WHEN NOT registration_completed THEN mc.msg_count  END)::numeric,1)  AS unreg_avg_messages,
          ROUND(AVG(CASE WHEN NOT registration_completed THEN mc.active_days END)::numeric,1) AS unreg_avg_days,
          ROUND((100.0 * COUNT(*) FILTER (WHERE NOT registration_completed AND EXISTS(
            SELECT 1 FROM lesson_plan_requests l WHERE l.user_id=cohort.id AND l.status='completed'
          )) / NULLIF(COUNT(*) FILTER (WHERE NOT registration_completed),0))::numeric,1)     AS unreg_lp_pct,
          ROUND((100.0 * COUNT(*) FILTER (WHERE NOT registration_completed AND EXISTS(
            SELECT 1 FROM coaching_sessions cs WHERE cs.user_id=cohort.id AND cs.status='completed'
          )) / NULLIF(COUNT(*) FILTER (WHERE NOT registration_completed),0))::numeric,1)     AS unreg_cs_pct,
          ROUND((100.0 * COUNT(*) FILTER (WHERE NOT registration_completed AND EXISTS(
            SELECT 1 FROM reading_assessments ra WHERE ra.user_id=cohort.id AND ra.status='completed'
          )) / NULLIF(COUNT(*) FILTER (WHERE NOT registration_completed),0))::numeric,1)     AS unreg_ra_pct
        FROM cohort
        LEFT JOIN msg_counts mc ON mc.user_id = cohort.id`,
        params
      ),

      // ── Query 2: Message bucket distribution ──
      pool.query(
        `WITH ${cohortCTE()}
        SELECT
          CASE
            WHEN COALESCE(mc.msg_count, 0) = 0  THEN '0'
            WHEN mc.msg_count <= 3              THEN '1-3'
            WHEN mc.msg_count <= 6              THEN '4-6'
            WHEN mc.msg_count <= 9              THEN '7-9'
            WHEN mc.msg_count = 10              THEN '10'
            WHEN mc.msg_count <= 19             THEN '11-19'
            ELSE '20+'
          END                                                        AS bucket,
          COUNT(*)::int                                              AS count,
          COUNT(*) FILTER (WHERE c.registration_completed)::int     AS registered
        FROM cohort c
        LEFT JOIN msg_counts mc ON mc.user_id = c.id
        GROUP BY 1
        ORDER BY MIN(COALESCE(mc.msg_count, 0))`,
        params
      ),

      // ── Query 3: Country breakdown ──
      pool.query(
        `WITH ${cohortCTE()}
        SELECT
          cc,
          CASE cc
            WHEN '92' THEN '🇵🇰 Pakistan'
            WHEN '94' THEN '🇱🇰 Sri Lanka'
            WHEN '96' THEN '🇲🇲 Myanmar'
            ELSE '🌍 Other'
          END                                                        AS label,
          COUNT(*)::int                                              AS total,
          COUNT(*) FILTER (WHERE registration_completed)::int       AS registered
        FROM cohort
        GROUP BY cc
        ORDER BY total DESC`,
        params
      ),
    ])

    const summary = summaryRes.rows[0]

    return NextResponse.json({
      week_start: week,
      summary: {
        ...summary,
        unregistered: (summary.total_users as number) - (summary.registered as number),
      },
      message_buckets: bucketsRes.rows,
      countries:       countriesRes.rows,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
