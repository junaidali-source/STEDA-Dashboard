import { Pool } from 'pg'
import { userRegionWhereSql } from '@/lib/pk-regions'

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
 * Canonical organization key from users.organization (WhatsApp form field).
 * Keep this in sync with /api/partners labels.
 */
export function organizationKeySql(alias = 'u'): string {
  return `
    CASE
      WHEN LOWER(TRIM(COALESCE(${alias}.organization, ''))) IN ('', 'none', 'no', 'other', 'n/a', 'na') THEN ''
      WHEN LOWER(TRIM(COALESCE(${alias}.organization, ''))) LIKE '%taleemabad%' THEN 'taleemabad'
      WHEN LOWER(TRIM(COALESCE(${alias}.organization, ''))) LIKE '%shofco%'
        OR LOWER(TRIM(COALESCE(${alias}.organization, ''))) LIKE '%shining hope for communities%' THEN 'shofco'
      WHEN LOWER(TRIM(COALESCE(${alias}.organization, ''))) ~ '(^|[^a-z])tcf([^a-z]|$)' THEN 'tcf'
      WHEN (
        LOWER(TRIM(COALESCE(${alias}.organization, ''))) LIKE '%aps%askari%14%'
        OR LOWER(TRIM(COALESCE(${alias}.organization, ''))) LIKE '%apsaskari14%'
        OR LOWER(TRIM(COALESCE(${alias}.organization, ''))) LIKE '%apsac%askari%14%'
        OR LOWER(TRIM(COALESCE(${alias}.organization, ''))) LIKE '%apsacs%askari%14%'
        OR LOWER(TRIM(COALESCE(${alias}.organization, ''))) LIKE '%askari xiv%'
      ) THEN 'aps_askari_14'
      ELSE BTRIM(REGEXP_REPLACE(LOWER(TRIM(COALESCE(${alias}.organization, ''))), '[^a-z0-9]+', '_', 'g'), '_')
    END
  `
}

/**
 * Standard user WHERE block — $1–$4 as before, $7 = Pakistan region slug ('' = all).
 *   $1 = country   ('all' = no filter)
 *   $2 = school    ('' = no filter)
 *   $3 = %school%  (ILIKE pattern)
 *   $4 = partner key (derived from users.organization, '' = no filter)
 */
export function userWhere(alias = 'u'): string {
  return `
    COALESCE(${alias}.is_test_user, false) = false
    AND ($1 = 'all' OR LEFT(${alias}.phone_number, 2) = $1)
    AND ($2 = '' OR ${alias}.school_name ILIKE $3)
    AND ($4 = '' OR ${organizationKeySql(alias)} = $4)
    AND ${userRegionWhereSql(alias)}
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
 * Extract filter params from a URL.
 * Returns: [country, school, '%school%', partnerId, fromDate, toDate, regionSlug]
 */
export function filterParams(url: string): [string, string, string, string, string, string, string] {
  const sp      = new URL(url).searchParams
  const country = sp.get('country') || 'all'
  const school  = sp.get('school')  || ''
  const partner = sp.get('partner') || ''
  const from    = sp.get('from')    || ''
  const to      = sp.get('to')      || ''
  const region  = sp.get('region')  || ''
  return [country, school, `%${school}%`, partner, from, to, region]
}
