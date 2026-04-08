import { NextResponse } from 'next/server'
import { pool, filterParams, organizationKeySql } from '@/lib/db'
import { userRegionWhereSql } from '@/lib/pk-regions'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const q = sp.get('q') || ''
  const [country, , , partner] = filterParams(req.url)
  const region = new URL(req.url).searchParams.get('region') || ''

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT school_name
      FROM users u
      WHERE COALESCE(is_test_user, false) = false
        AND school_name IS NOT NULL AND school_name <> ''
        AND ($1 = 'all' OR LEFT(phone_number, 2) = $1)
        AND school_name ILIKE $2
        AND ($3 = '' OR phone_number IN (
          SELECT phone_number
          FROM users pu
          WHERE COALESCE(pu.is_test_user, false) = false
            AND ${organizationKeySql('pu')} = $3
        ))
        AND ${userRegionWhereSql('u', 4)}
      ORDER BY school_name
      LIMIT 25`,
      [country, `%${q}%`, partner, region]
    )
    return NextResponse.json(rows.map((r) => r.school_name))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
