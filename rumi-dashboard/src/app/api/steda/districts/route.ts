import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getSteadaData } from '@/lib/steda-phones'

export async function GET() {
  try {
    const { phones, districtListed } = getSteadaData()

    // Get onboarded count per district
    const res = await pool.query(
      `SELECT u.school_name,
              -- We'll group by district via phone → CSV lookup client-side
              u.phone_number,
              u.registration_completed
       FROM users u
       WHERE u.phone_number = ANY($1::text[])
         AND COALESCE(u.is_test_user, false) = false`,
      [phones]
    )

    // Build phone → district map from CSV data
    const { teachers } = getSteadaData()
    const phoneToDistrict: Record<string, string> = {}
    for (const t of teachers) {
      phoneToDistrict[t.phone] = t.district
    }

    // Count onboarded per district
    const districtOnboarded: Record<string, number> = {}
    for (const row of res.rows) {
      const district = phoneToDistrict[row.phone_number]
      if (district) {
        districtOnboarded[district] = (districtOnboarded[district] || 0) + 1
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
