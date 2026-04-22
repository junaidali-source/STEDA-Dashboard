import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getSteadaData } from '@/lib/steda-phones'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sp      = new URL(req.url).searchParams
    const from    = sp.get('from')    || null
    const to      = sp.get('to')      || null
    const partner = sp.get('partner') || null
    const scope   = sp.get('scope')   || null

    const JOIN_DC = (p2: string, p3: string) =>
      `AND (${p2}::date IS NULL OR cs.created_at::date >= ${p2}::date)
       AND (${p3}::date IS NULL OR cs.created_at::date <= ${p3}::date)`

    let distribution: Array<{ sessions: number; users: number }> = []

    if (scope === 'steda') {
      const { phones } = getSteadaData()

      const idsRes = await pool.query(
        `SELECT id FROM users WHERE phone_number = ANY($1::text[]) AND COALESCE(is_test_user,false)=false`,
        [phones]
      )
      const ids = idsRes.rows.map((r: { id: string }) => r.id)
      if (ids.length === 0) return NextResponse.json({ distribution: [] })

      const res = await pool.query(
        `SELECT session_count, COUNT(*) AS user_count
         FROM (
           SELECT u.id, COUNT(cs.id) AS session_count
           FROM users u
           LEFT JOIN coaching_sessions cs ON cs.user_id = u.id ${JOIN_DC('$2', '$3')}
           WHERE u.id = ANY($1::uuid[])
           GROUP BY u.id
           HAVING COUNT(cs.id) > 0
         ) sub
         GROUP BY session_count
         ORDER BY session_count`,
        [ids, from, to]
      )

      distribution = res.rows.map(r => ({
        sessions: r.session_count,
        users: parseInt(r.user_count),
      }))
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
      if (ids.length === 0) return NextResponse.json({ distribution: [] })

      const res = await pool.query(
        `SELECT session_count, COUNT(*) AS user_count
         FROM (
           SELECT u.id, COUNT(cs.id) AS session_count
           FROM users u
           LEFT JOIN coaching_sessions cs ON cs.user_id = u.id ${JOIN_DC('$2', '$3')}
           WHERE u.id = ANY($1::uuid[])
           GROUP BY u.id
           HAVING COUNT(cs.id) > 0
         ) sub
         GROUP BY session_count
         ORDER BY session_count`,
        [ids, from, to]
      )

      distribution = res.rows.map(r => ({
        sessions: r.session_count,
        users: parseInt(r.user_count),
      }))
    } else {
      // Global admin: all users with at least 1 session
      const res = await pool.query(
        `SELECT session_count, COUNT(*) AS user_count
         FROM (
           SELECT u.id, COUNT(cs.id) AS session_count
           FROM users u
           LEFT JOIN coaching_sessions cs ON cs.user_id = u.id ${JOIN_DC('$1', '$2')}
           WHERE COALESCE(u.is_test_user,false)=false
           GROUP BY u.id
           HAVING COUNT(cs.id) > 0
         ) sub
         GROUP BY session_count
         ORDER BY session_count`,
        [from, to]
      )

      distribution = res.rows.map(r => ({
        sessions: r.session_count,
        users: parseInt(r.user_count),
      }))
    }

    // Bucket 5+ sessions together
    const bucketedDistribution = distribution.reduce((acc, item) => {
      if (item.sessions >= 5) {
        const existing = acc.find(b => b.sessions === '5+')
        if (existing) {
          existing.users += item.users
        } else {
          acc.push({ sessions: '5+' as any, users: item.users })
        }
      } else {
        acc.push(item)
      }
      return acc
    }, [] as Array<{ sessions: number | string; users: number }>)

    return NextResponse.json({ distribution: bucketedDistribution })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
