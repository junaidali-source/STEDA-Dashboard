import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getFilteredStedaTeachers, stedaScopeFromSearchParams } from '@/lib/steda-scope'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { region, district } = stedaScopeFromSearchParams(req.nextUrl.searchParams)
    const teachers = await getFilteredStedaTeachers(region, district)
    const phones = teachers.map((t) => t.phone)
    const districtListed: Record<string, number> = {}
    for (const t of teachers) {
      const d = (t.district || '').trim()
      if (d) districtListed[d] = (districtListed[d] || 0) + 1
    }

    // Get onboarded count per district
    const res =
      phones.length === 0
        ? { rows: [] as { phone_number: string }[] }
        : await pool.query(
            `SELECT u.phone_number
       FROM users u
       WHERE u.phone_number = ANY($1::text[])
         AND COALESCE(u.is_test_user, false) = false`,
            [phones]
          )

    const phoneToDistrict: Record<string, string> = {}
    for (const t of teachers) {
      phoneToDistrict[t.phone] = t.district
    }

    // Count onboarded per district
    const districtOnboarded: Record<string, number> = {}
    for (const row of res.rows as { phone_number: string }[]) {
      const dKey = phoneToDistrict[row.phone_number]
      if (dKey) {
        districtOnboarded[dKey] = (districtOnboarded[dKey] || 0) + 1
      }
    }

    // Combine
    const districts = Object.entries(districtListed)
      .map(([district, listed]) => {
        const onboarded = districtOnboarded[district] || 0
        return {
          district,
          listed,
          onboarded,
          notYet: listed - onboarded,
          pct: listed > 0 ? Math.round((onboarded / listed) * 100) : 0,
        }
      })
      .sort((a, b) => b.listed - a.listed)

    return NextResponse.json(districts)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
