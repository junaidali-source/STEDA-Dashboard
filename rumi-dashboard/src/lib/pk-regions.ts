/** Pakistan region slugs aligned with `users.region` (plus UI aliases). */
export const PK_REGION_OPTIONS: { slug: string; label: string }[] = [
  { slug: '', label: 'All regions' },
  { slug: 'sindh', label: 'Sindh' },
  { slug: 'islamabad', label: 'Islamabad' },
  { slug: 'balochistan', label: 'Balochistan' },
  { slug: 'punjab', label: 'Punjab' },
  { slug: 'kpk', label: 'KPK' },
  { slug: '__unspecified__', label: 'Unspecified' },
]

/**
 * SQL fragment for `users` alias `alias`. `paramNum` must match the query bind position (dashboard APIs use 7).
 */
export function userRegionWhereSql(alias: string, paramNum = 7): string {
  const p = `$${paramNum}`
  return `(
    ${p}::text = '' OR
    (${p} = '__unspecified__' AND (${alias}.region IS NULL OR TRIM(${alias}.region::text) = '')) OR
    (${p} = 'islamabad' AND LOWER(TRIM(COALESCE(${alias}.region::text,''))) IN ('federal','islamabad')) OR
    (${p} <> '__unspecified__' AND ${p} <> 'islamabad' AND LOWER(TRIM(COALESCE(${alias}.region::text,''))) = LOWER(TRIM(${p}::text)))
  )`
}
