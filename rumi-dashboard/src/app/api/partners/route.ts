import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

// Personal/generic email domains to exclude
const PERSONAL_DOMAINS = new Set([
  'gmail.com','yahoo.com','outlook.com','hotmail.com',
  'live.com','icloud.com','protonmail.com','me.com',
])

function toName(domain: string): string {
  // e.g. tcf.org.pk → TCF   apsaskari14.com → Aps Askari 14
  const base = domain.split('.')[0]
  // Short abbreviations (≤4 chars all-alpha) → all caps: tcf → TCF
  if (/^[a-zA-Z]{2,4}$/.test(base)) return base.toUpperCase()
  // Insert spaces before digit/letter boundaries
  return base
    .replace(/([a-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-z])/gi, '$1 $2')
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        du.id,
        du.email,
        SPLIT_PART(du.email, '@', 2)          AS domain,
        ast.scope_type,
        (
          SELECT COUNT(*)::int
          FROM jsonb_array_elements_text(ast.scope_value->'phone_numbers')
        )                                      AS teacher_count
      FROM dashboard_users du
      LEFT JOIN access_scopes ast ON ast.dashboard_user_id = du.id
      WHERE du.role IN ('partner_admin', 'partner_viewer')
        AND du.email NOT LIKE 'test-%'
        AND du.email NOT LIKE '%@test.com'
        AND SPLIT_PART(du.email, '@', 2) NOT IN (
          'gmail.com','yahoo.com','outlook.com','hotmail.com',
          'live.com','icloud.com','protonmail.com','me.com'
        )
        AND ast.scope_type = 'phone_list'
      ORDER BY SPLIT_PART(du.email, '@', 2)
    `)

    const partners = rows
      .filter((r) => !PERSONAL_DOMAINS.has(r.domain as string))
      .map((r) => ({
        id: r.id as string,
        name: toName(r.domain as string),
        email: r.email as string,
        domain: r.domain as string,
        teacher_count: r.teacher_count as number,
      }))

    return NextResponse.json(partners)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
