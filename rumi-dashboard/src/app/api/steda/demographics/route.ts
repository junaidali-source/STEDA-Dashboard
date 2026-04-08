import { NextRequest, NextResponse } from 'next/server'
import { getFilteredStedaTeachers, stedaScopeFromSearchParams } from '@/lib/steda-scope'

export const dynamic = 'force-dynamic'

const DESIG_ORDER = ['PST', 'EST', 'SST', 'HST', 'JEST/JST', 'ECT', 'Sr. ECT', 'Lecturer']

export async function GET(req: NextRequest) {
  try {
    const { region, district } = stedaScopeFromSearchParams(req.nextUrl.searchParams)
    const teachers = await getFilteredStedaTeachers(region, district)
    const gender: Record<string, number> = {}
    const schoolType: Record<string, number> = {}
    const designations: Record<string, number> = {}
    for (const t of teachers) {
      const gen = (t.gender || '').trim()
      const st = (t.schoolType || '').trim()
      const des = (t.designation || '').trim()
      if (gen) gender[gen] = (gender[gen] || 0) + 1
      if (st) schoolType[st] = (schoolType[st] || 0) + 1
      if (des) designations[des] = (designations[des] || 0) + 1
    }

    // Sort designations by known order, then alphabetically for unknowns
    const desigEntries = Object.entries(designations).sort(([a], [b]) => {
      const ai = DESIG_ORDER.indexOf(a)
      const bi = DESIG_ORDER.indexOf(b)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return a.localeCompare(b)
    })

    return NextResponse.json({
      gender: Object.entries(gender).map(([name, value]) => ({ name, value })),
      schoolType: Object.entries(schoolType).map(([name, value]) => ({ name, value })),
      designations: desigEntries.map(([name, value]) => ({ name, value })),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
