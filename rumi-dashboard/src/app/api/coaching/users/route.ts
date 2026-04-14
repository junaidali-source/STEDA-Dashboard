import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getSteadaData } from '@/lib/steda-phones'

export const dynamic = 'force-dynamic'

const SCORE_FILTER = `cs.status='completed' AND cs.analysis_data IS NOT NULL`
const PCT = `COALESCE(cs.analysis_data->'scores'->>'percentage', cs.analysis_data->'scores'->>'overall_percentage')`

const SELECT_COLS = `
  u.id,
  TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS name,
  u.phone_number,
  COALESCE(u.school_name, '—')            AS school,
  COALESCE(u.preferred_language, '—')     AS language,
  u.created_at::date                      AS joined,
  COUNT(cs.id)::int                       AS total_sessions,
  COUNT(cs.id) FILTER(WHERE cs.status='completed')::int AS completed_sessions,
  MIN(cs.created_at)::date                AS first_session,
  MAX(cs.created_at)::date                AS last_session,
  ROUND(AVG((${PCT})::numeric)
    FILTER(WHERE ${SCORE_FILTER}), 1)     AS avg_score,
  (array_agg((${PCT})::numeric
    ORDER BY cs.created_at ASC)  FILTER(WHERE ${SCORE_FILTER}))[1] AS first_score,
  (array_agg((${PCT})::numeric
    ORDER BY cs.created_at DESC) FILTER(WHERE ${SCORE_FILTER}))[1] AS latest_score,
  ROUND(AVG((cs.analysis_data->'scores'->>'goal1_total')::numeric)
    FILTER(WHERE ${SCORE_FILTER}), 1)     AS avg_g1,
  ROUND(AVG((cs.analysis_data->'scores'->>'goal2_total')::numeric)
    FILTER(WHERE ${SCORE_FILTER}), 1)     AS avg_g2,
  ROUND(AVG((cs.analysis_data->'scores'->>'goal3_total')::numeric)
    FILTER(WHERE ${SCORE_FILTER}), 1)     AS avg_g3,
  ROUND(AVG((cs.analysis_data->'scores'->>'goal4_total')::numeric)
    FILTER(WHERE ${SCORE_FILTER}), 1)     AS avg_g4,
  ROUND(AVG((cs.analysis_data->'scores'->>'goal5_total')::numeric)
    FILTER(WHERE ${SCORE_FILTER}), 1)     AS avg_g5`

const GROUP_BY = `
  GROUP BY u.id, u.first_name, u.last_name, u.phone_number, u.school_name, u.preferred_language, u.created_at`

export async function GET(req: NextRequest) {
  try {
    const sp      = new URL(req.url).searchParams
    const from    = sp.get('from')    || null
    const to      = sp.get('to')      || null
    const partner = sp.get('partner') || null
    const scope   = sp.get('scope')   || null

    // Date condition for LEFT JOIN — uses $2/$3 (ids-based) or $1/$2 (global)
    const JOIN_DC = (p2: string, p3: string) =>
      `AND (${p2}::date IS NULL OR cs.created_at::date >= ${p2}::date)
       AND (${p3}::date IS NULL OR cs.created_at::date <= ${p3}::date)`

    let rows: Record<string, unknown>[]

    if (scope === 'steda') {
      const { phones, teachers } = getSteadaData()
      const teacherMap = new Map(teachers.map(t => [t.phone, t]))

      const idsRes = await pool.query(
        `SELECT id FROM users WHERE phone_number = ANY($1::text[]) AND COALESCE(is_test_user,false)=false`,
        [phones]
      )
      const ids = idsRes.rows.map((r: { id: string }) => r.id)
      if (ids.length === 0) return NextResponse.json([])

      const res = await pool.query(
        `SELECT ${SELECT_COLS}
         FROM users u
         LEFT JOIN coaching_sessions cs ON cs.user_id = u.id ${JOIN_DC('$2', '$3')}
         WHERE u.id = ANY($1::uuid[])
         ${GROUP_BY}
         ORDER BY completed_sessions DESC, total_sessions DESC, u.first_name
         LIMIT 2000`,
        [ids, from, to]
      )
      // Enrich with district/designation from CSV
      rows = res.rows.map(r => {
        const t = teacherMap.get(r.phone_number as string)
        return {
          ...r,
          district:    t?.district    ?? '—',
          designation: t?.designation ?? '—',
          gender:      t?.gender      ?? '—',
        }
      })
    } else if (partner) {
      const idsRes = await pool.query(
        `SELECT u.id FROM users u
         WHERE u.phone_number IN (
           SELECT jsonb_array_elements_text(ast.scope_value->'phone_numbers')
           FROM access_scopes ast WHERE ast.dashboard_user_id=$1::uuid AND ast.scope_type='phone_list'
         ) AND COALESCE(u.is_test_user,false)=false`,
        [partner]
      )
      const ids = idsRes.rows.map((r: { id: string }) => r.id)
      if (ids.length === 0) return NextResponse.json([])

      const res = await pool.query(
        `SELECT ${SELECT_COLS}
         FROM users u
         LEFT JOIN coaching_sessions cs ON cs.user_id = u.id ${JOIN_DC('$2', '$3')}
         WHERE u.id = ANY($1::uuid[])
         ${GROUP_BY}
         ORDER BY completed_sessions DESC, total_sessions DESC, u.first_name
         LIMIT 1000`,
        [ids, from, to]
      )
      rows = res.rows
    } else {
      // Global admin: only users who have had ≥1 session
      const res = await pool.query(
        `SELECT ${SELECT_COLS}
         FROM users u
         LEFT JOIN coaching_sessions cs ON cs.user_id = u.id ${JOIN_DC('$1', '$2')}
         WHERE COALESCE(u.is_test_user,false)=false
         ${GROUP_BY}
         HAVING COUNT(cs.id) > 0
         ORDER BY completed_sessions DESC, total_sessions DESC, u.first_name
         LIMIT 1000`,
        [from, to]
      )
      rows = res.rows
    }

    return NextResponse.json(rows)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
