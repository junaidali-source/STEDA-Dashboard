import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sp      = new URL(req.url).searchParams
  const country = sp.get('country') || 'all'
  const partner = sp.get('partner') || ''

  try {
    const { rows } = await pool.query(
      `SELECT
        DATE_TRUNC('week', u.created_at)::date AS week_start,
        TO_CHAR(DATE_TRUNC('week', u.created_at), 'Mon DD') || ' - ' ||
        TO_CHAR(DATE_TRUNC('week', u.created_at) + INTERVAL '6 days', 'Mon DD, YYYY')
                                                                         AS week_label,
        COUNT(*)::int                                                     AS user_count
      FROM users u
      WHERE COALESCE(u.is_test_user, false) = false
        AND ($1 = 'all' OR LEFT(u.phone_number, 2) = $1)
        AND ($2 = '' OR u.phone_number IN (
          SELECT jsonb_array_elements_text(scope_value->'phone_numbers')
          FROM access_scopes
          WHERE dashboard_user_id = $2::uuid AND scope_type = 'phone_list'
        ))
      GROUP BY DATE_TRUNC('week', u.created_at)
      ORDER BY DATE_TRUNC('week', u.created_at) DESC
      LIMIT 52`,
      [country, partner]
    )
    return NextResponse.json(rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
