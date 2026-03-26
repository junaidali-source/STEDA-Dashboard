import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint — shows ALL dashboard_users and their scopes,
 * with NO filtering, so we can see exactly what's in the DB.
 * Visit: /api/debug/partners
 */
export async function GET() {
  try {
    // 1. All dashboard users + their roles
    const { rows: users } = await pool.query(`
      SELECT
        du.id,
        du.email,
        du.role,
        SPLIT_PART(du.email, '@', 2)  AS domain,
        ast.scope_type,
        ast.scope_value
      FROM dashboard_users du
      LEFT JOIN access_scopes ast ON ast.dashboard_user_id = du.id
      ORDER BY du.role, du.email
    `)

    // 2. Distinct roles present
    const { rows: roles } = await pool.query(`
      SELECT role, COUNT(*)::int AS count
      FROM dashboard_users
      GROUP BY role ORDER BY count DESC
    `)

    // 3. Distinct scope types present
    const { rows: scopeTypes } = await pool.query(`
      SELECT scope_type, COUNT(*)::int AS count
      FROM access_scopes
      GROUP BY scope_type ORDER BY count DESC
    `)

    return NextResponse.json({
      roles,
      scope_types: scopeTypes,
      all_users: users.map((u) => ({
        email:      u.email,
        role:       u.role,
        domain:     u.domain,
        scope_type: u.scope_type,
        // show first 3 phone numbers from scope_value if it's a phone_list
        scope_preview: u.scope_value
          ? JSON.stringify(u.scope_value).slice(0, 120) + '…'
          : null,
      })),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
