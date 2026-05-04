/**
 * One-off: list partner dashboard_users (read-only). Uses ANALYST_DATABASE_URL or DATABASE_URL.
 */
import pg from 'pg'

const url = process.env.ANALYST_DATABASE_URL || process.env.DATABASE_URL
if (!url) {
  console.error('Set ANALYST_DATABASE_URL (postgresql://...)')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()
const { rows } = await client.query(`
  SELECT
    du.id::text,
    du.email,
    du.role,
    du.organization_id::text,
    du.created_at
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
await client.end()
console.log(JSON.stringify(rows, null, 2))
