import { pool } from '@/lib/db'
import { getSteadaData, type SteadaTeacher } from '@/lib/steda-phones'

interface CacheEntry { phones: string[]; timestamp: number }
const g = global as typeof global & { _phonesCache?: Map<string, CacheEntry> }
if (!g._phonesCache) g._phonesCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function stedaScopeFromSearchParams(sp: URLSearchParams): { region: string; district: string } {
  return {
    region: sp.get('region')?.trim() || '',
    district: sp.get('district')?.trim() || '',
  }
}

/** WHERE for cohort phone `c` LEFT JOIN users `u`, param $2 = region slug */
function cohortRegionWhere(cAlias: string, uAlias: string, regParam: string): string {
  return `(
    ${regParam} = '' OR
    (${regParam} = '__unspecified__' AND (${uAlias}.id IS NULL OR ${uAlias}.region IS NULL OR TRIM(${uAlias}.region::text) = '')) OR
    (${regParam} = 'islamabad' AND ${uAlias}.id IS NOT NULL AND LOWER(TRIM(COALESCE(${uAlias}.region::text,''))) IN ('federal','islamabad')) OR
    (${regParam} NOT IN ('__unspecified__','islamabad') AND ${uAlias}.id IS NOT NULL AND LOWER(TRIM(COALESCE(${uAlias}.region::text,''))) = LOWER(TRIM(${regParam})))
  )`
}

/**
 * STEDA cohort phones after optional CSV district filter and optional `users.region` filter.
 * Results cached for 5 minutes to avoid repeated database queries.
 */
export async function getFilteredStedaPhones(region: string, district: string): Promise<string[]> {
  const { teachers } = getSteadaData()
  let subset = teachers
  if (district) {
    const d = district.trim().toLowerCase()
    subset = teachers.filter((t) => t.district.trim().toLowerCase() === d)
  }
  const phones = Array.from(new Set(subset.map((t) => t.phone)))
  const reg = (region || '').trim()
  if (!reg || phones.length === 0) return phones

  const cacheKey = `${district}|${region}`
  const cached = g._phonesCache?.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.phones
  }

  try {
    const { rows } = await pool.query<{ phone: string }>(
      `WITH cohort AS (SELECT unnest($1::text[]) AS phone)
       SELECT c.phone::text
       FROM cohort c
       LEFT JOIN users u ON u.phone_number = c.phone AND COALESCE(u.is_test_user, false) = false
       WHERE ${cohortRegionWhere('c', 'u', '$2')}`,
      [phones, reg]
    )
    const result = rows.map((r) => r.phone)
    g._phonesCache?.set(cacheKey, { phones: result, timestamp: Date.now() })
    return result
  } catch (err) {
    console.error('Region filter failed, returning all STEDA phones:', err)
    g._phonesCache?.set(cacheKey, { phones, timestamp: Date.now() })
    return phones
  }
}

export async function getFilteredStedaTeachers(
  region: string,
  district: string
): Promise<SteadaTeacher[]> {
  const phoneSet = new Set(await getFilteredStedaPhones(region, district))
  const { teachers } = getSteadaData()
  return teachers.filter((t) => phoneSet.has(t.phone))
}
