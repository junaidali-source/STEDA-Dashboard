import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
  'live.com', 'icloud.com', 'protonmail.com', 'me.com',
])

/** Derive a short label from organisation domain (e.g. tcf.org.pk → TCF). */
function nameFromOrgDomain(domain: string): string {
  const base = domain.split('.')[0] || domain
  if (/^[a-zA-Z]{2,4}$/.test(base)) return base.toUpperCase()
  return base
    .replace(/([a-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-z])/gi, '$1 $2')
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function nameFromEmail(email: string, domain: string): string {
  const d = (domain || '').toLowerCase()
  if (!PERSONAL_DOMAINS.has(d)) return nameFromOrgDomain(domain || email.split('@')[1] || '')

  const local = (email.split('@')[0] || 'partner').replace(/[.+_-]+/g, ' ').trim()
  if (!local) return 'Partner'
  return local
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/**
 * All partner dashboard accounts (any partner* role), even if they have no
 * phone_list scope yet. Teacher count sums phones across all phone_list rows.
 */
export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        du.id,
        du.email,
        du.role,
        NULLIF(TRIM(SPLIT_PART(du.email, '@', 2)), '') AS domain,
        COALESCE((
          SELECT SUM(sc.c)::int
          FROM (
            SELECT
              CASE
                WHEN ast.scope_value ? 'phone_numbers'
                 AND jsonb_typeof(ast.scope_value->'phone_numbers') = 'array'
                THEN (
                  SELECT COUNT(*)::int
                  FROM jsonb_array_elements_text(ast.scope_value->'phone_numbers')
                )
                ELSE 0
              END AS c
            FROM access_scopes ast
            WHERE ast.dashboard_user_id = du.id
              AND ast.scope_type = 'phone_list'
          ) sc
        ), 0) AS teacher_count
      FROM dashboard_users du
      WHERE (
          LOWER(du.role) IN ('partner', 'partner_admin', 'partner_viewer')
          OR LOWER(du.role) LIKE 'partner\\_%' ESCAPE '\\'
        )
        AND du.email NOT ILIKE 'test-%'
        AND du.email NOT ILIKE '%@test.com'
        AND POSITION('@' IN du.email) > 1
      ORDER BY LOWER(du.email)
    `)

    const partners = rows.map((r) => {
      const email = r.email as string
      const domain = (r.domain as string) || ''
      return {
        id: r.id as string,
        name: nameFromEmail(email, domain),
        email,
        domain: domain || email.split('@')[1] || '',
        teacher_count: Number(r.teacher_count) || 0,
      }
    })

    return NextResponse.json(partners)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
