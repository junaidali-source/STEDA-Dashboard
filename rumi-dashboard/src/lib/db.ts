import { Pool } from 'pg'

const g = global as typeof global & { _pgPool?: Pool }

if (!g._pgPool) {
  g._pgPool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 6543),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })
}

export const pool = g._pgPool!

/**
 * Standard 4-param user WHERE block — always $1–$4.
 *   $1 = country   ('all' = no filter)
 *   $2 = school    ('' = no filter)
 *   $3 = %school%  (ILIKE pattern)
 *   $4 = partnerId (dashboard_user_id uuid string, '' = no filter)
 */
export function userWhere(alias = 'u'): string {
  return `
    COALESCE(${alias}.is_test_user, false) = false
    AND ($1 = 'all' OR LEFT(${alias}.phone_number, 2) = $1)
    AND ($2 = '' OR ${alias}.school_name ILIKE $3)
    AND ($4 = '' OR ${alias}.phone_number IN (
      SELECT jsonb_array_elements_text(scope_value->'phone_numbers')
      FROM access_scopes
      WHERE dashboard_user_id = $4::uuid
        AND scope_type = 'phone_list'
    ))
  `
}

/**
 * Date range WHERE conditions using params $5 (from) and $6 (to).
 * @param alias - table alias that has a created_at column
 */
export function dateWhere(alias: string): string {
  return `
    AND ($5 = '' OR ${alias}.created_at >= $5::timestamptz)
    AND ($6 = '' OR ${alias}.created_at <  ($6::date + INTERVAL '1 day')::timestamptz)
  `
}

/**
 * Extract the standard 6 filter params from a URL.
 * Returns: [country, school, '%school%', partnerId, fromDate, toDate]
 */
export function filterParams(url: string): [string, string, string, string, string, string] {
  const sp      = new URL(url).searchParams
  const country = sp.get('country') || 'all'
  const school  = sp.get('school')  || ''
  const partner = sp.get('partner') || ''
  const from    = sp.get('from')    || ''
  const to      = sp.get('to')      || ''
  return [country, school, `%${school}%`, partner, from, to]
}
