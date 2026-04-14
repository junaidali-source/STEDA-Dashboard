import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getSteadaData } from '@/lib/steda-phones'

export const dynamic = 'force-dynamic'

const empty = () => ({
  usersWithSessions: 0, totalSessions: 0, completedSessions: 0,
  completionRate: 0, activeThisMonth: 0, sessionsThisMonth: 0,
  avgScore: null, topScore: null, lowScore: null,
})

export async function GET(req: NextRequest) {
  try {
    const sp      = new URL(req.url).searchParams
    const from    = sp.get('from')    || null
    const to      = sp.get('to')      || null
    const partner = sp.get('partner') || null
    const scope   = sp.get('scope')   || null

    const SF = `cs.status='completed' AND cs.analysis_data IS NOT NULL`
    const PCT = `COALESCE(cs.analysis_data->'scores'->>'percentage', cs.analysis_data->'scores'->>'overall_percentage')`
    const COLS = `
      COUNT(DISTINCT cs.user_id)::int AS users_with_sessions,
      COUNT(*)::int AS total_sessions,
      COUNT(*) FILTER(WHERE cs.status='completed')::int AS completed_sessions,
      COUNT(DISTINCT cs.user_id) FILTER(WHERE cs.created_at >= date_trunc('month', now()))::int AS active_this_month,
      COUNT(*) FILTER(WHERE cs.created_at >= date_trunc('month', now()))::int AS sessions_this_month,
      ROUND(AVG((${PCT})::numeric) FILTER(WHERE ${SF}), 1) AS avg_score,
      ROUND(MAX((${PCT})::numeric) FILTER(WHERE ${SF}), 1) AS top_score,
      ROUND(MIN((${PCT})::numeric) FILTER(WHERE ${SF}), 1) AS low_score`

    let rows: Record<string, number>[]

    if (scope === 'steda') {
      const { phones } = getSteadaData()
      const idsRes = await pool.query(
        `SELECT id FROM users WHERE phone_number = ANY($1::text[]) AND COALESCE(is_test_user,false)=false`,
        [phones]
      )
      const ids = idsRes.rows.map((r: { id: string }) => r.id)
      if (ids.length === 0) return NextResponse.json(empty())
      const res = await pool.query(
        `SELECT ${COLS} FROM coaching_sessions cs
         WHERE cs.user_id = ANY($1::uuid[])
           AND ($2::date IS NULL OR cs.created_at::date >= $2::date)
           AND ($3::date IS NULL OR cs.created_at::date <= $3::date)`,
        [ids, from, to]
      )
      rows = res.rows
    } else if (partner) {
      const res = await pool.query(
        `SELECT ${COLS} FROM coaching_sessions cs
         JOIN users u ON u.id = cs.user_id
         WHERE u.phone_number IN (
           SELECT jsonb_array_elements_text(ast.scope_value->'phone_numbers')
           FROM access_scopes ast WHERE ast.dashboard_user_id=$1::uuid AND ast.scope_type='phone_list'
         ) AND COALESCE(u.is_test_user,false)=false
           AND ($2::date IS NULL OR cs.created_at::date >= $2::date)
           AND ($3::date IS NULL OR cs.created_at::date <= $3::date)`,
        [partner, from, to]
      )
      rows = res.rows
    } else {
      const res = await pool.query(
        `SELECT ${COLS} FROM coaching_sessions cs
         JOIN users u ON u.id = cs.user_id
         WHERE COALESCE(u.is_test_user,false)=false
           AND ($1::date IS NULL OR cs.created_at::date >= $1::date)
           AND ($2::date IS NULL OR cs.created_at::date <= $2::date)`,
        [from, to]
      )
      rows = res.rows
    }

    const r = rows[0]
    return NextResponse.json({
      usersWithSessions: r.users_with_sessions  ?? 0,
      totalSessions:     r.total_sessions       ?? 0,
      completedSessions: r.completed_sessions   ?? 0,
      completionRate:    r.total_sessions > 0
        ? Math.round((r.completed_sessions / r.total_sessions) * 100) : 0,
      activeThisMonth:   r.active_this_month    ?? 0,
      sessionsThisMonth: r.sessions_this_month  ?? 0,
      avgScore:          r.avg_score  ?? null,
      topScore:          r.top_score  ?? null,
      lowScore:          r.low_score  ?? null,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
