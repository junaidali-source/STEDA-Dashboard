import { NextResponse } from 'next/server'
import { pool, filterParams } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const q = sp.get('q') || ''
  const [country, , , partner] = filterParams(req.url)

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT school_name
      FROM users u
      WHERE COALESCE(is_test_user, false) = false
        AND school_name IS NOT NULL AND school_name <> ''
        AND ($1 = 'all' OR LEFT(phone_number, 2) = $1)
        AND school_name ILIKE $2
        AND ($3 = '' OR phone_number IN (
          SELECT jsonb_array_elements_text(scope_value->'phone_numbers')
          FROM access_scopes
          WHERE dashboard_user_id = $3::uuid
            AND scope_type = 'phone_list'
        ))
      ORDER BY school_name
      LIMIT 25`,
      [country, `%${q}%`, partner]
    )
    return NextResponse.json(rows.map((r) => r.school_name))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
