import { pool } from '@/lib/db'
import { getSteadaData, type SteadaTeacher } from '@/lib/steda-phones'

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
 * Optimized: Do region filtering in-memory instead of database JOIN.
 */
export async function getFilteredStedaPhones(region: string, district: string): Promise<string[]> {
  const { teachers } = getSteadaData()
  let subset = teachers

  if (district) {
    const d = district.trim().toLowerCase()
    subset = subset.filter((t) => t.district.trim().toLowerCase() === d)
  }

  if (region) {
    const reg = region.trim().toLowerCase()
    const { rows } = await pool.query<{ phone: string; region: string }>(
      `SELECT DISTINCT phone_number as phone, region FROM users WHERE phone_number = ANY($1::text[]) AND COALESCE(is_test_user, false) = false`,
      [subset.map((t) => t.phone)]
    )
    const phonesByRegion = new Map(rows.map((r) => [r.phone, r.region]))
    subset = subset.filter((t) => {
      const userRegion = phonesByRegion.get(t.phone)
      if (!userRegion) return false
      return userRegion.toLowerCase() === reg || (reg === 'islamabad' && ['federal', 'islamabad'].includes(userRegion.toLowerCase()))
    })
  }

  return Array.from(new Set(subset.map((t) => t.phone)))
}

export async function getFilteredStedaTeachers(
  region: string,
  district: string
): Promise<SteadaTeacher[]> {
  const phoneSet = new Set(await getFilteredStedaPhones(region, district))
  const { teachers } = getSteadaData()
  return teachers.filter((t) => phoneSet.has(t.phone))
}
