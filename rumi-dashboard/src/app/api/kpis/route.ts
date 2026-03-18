import { NextResponse } from 'next/server'
import { pool, userWhere, dateWhere, filterParams } from '@/lib/db'

function buildKpiQuery(): string {
  return `
    SELECT
      COUNT(*)::int                                                         AS total_users,
      COUNT(*) FILTER (WHERE u.registration_completed)::int                AS registered,
      ROUND(
        (100.0 * COUNT(*) FILTER (WHERE u.registration_completed)
        / NULLIF(COUNT(*), 0))::numeric, 1
      )                                                                     AS reg_rate,
      (SELECT COUNT(*)::int FROM conversations c2
        JOIN users u2 ON c2.user_id = u2.id
        WHERE c2.role = 'user' AND ${userWhere('u2')} ${dateWhere('c2')}
      )                                                                     AS total_messages,
      (SELECT COUNT(*)::int FROM lesson_plan_requests l
        JOIN users u3 ON l.user_id = u3.id
        WHERE l.status = 'completed' AND ${userWhere('u3')} ${dateWhere('l')}
      )                                                                     AS lesson_plans,
      (SELECT COUNT(*)::int FROM coaching_sessions cs
        JOIN users u4 ON cs.user_id = u4.id
        WHERE cs.status = 'completed' AND ${userWhere('u4')} ${dateWhere('cs')}
      )                                                                     AS coaching,
      (SELECT COUNT(*)::int FROM reading_assessments ra
        JOIN users u5 ON ra.user_id = u5.id
        WHERE ra.status = 'completed' AND ${userWhere('u5')} ${dateWhere('ra')}
      )                                                                     AS reading
    FROM users u
    WHERE ${userWhere('u')} ${dateWhere('u')}
  `
}

export async function GET(req: Request) {
  const sp           = new URL(req.url).searchParams
  const p            = filterParams(req.url)
  const compare_from = sp.get('compare_from') || ''
  const compare_to   = sp.get('compare_to')   || ''
  const hasCompare   = compare_from !== '' || compare_to !== ''

  try {
    const q = buildKpiQuery()
    const { rows } = await pool.query(q, p)

    let previous: Record<string, number> | null = null
    if (hasCompare) {
      const cp: [string, string, string, string, string, string] =
        [p[0], p[1], p[2], p[3], compare_from, compare_to]
      const { rows: prevRows } = await pool.query(q, cp)
      previous = prevRows[0] ?? null
    }

    return NextResponse.json({ current: rows[0], previous })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
