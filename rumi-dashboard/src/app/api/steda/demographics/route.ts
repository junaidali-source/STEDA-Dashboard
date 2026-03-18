import { NextResponse } from 'next/server'
import { getSteadaData } from '@/lib/steda-phones'

const DESIG_ORDER = ['PST', 'EST', 'SST', 'HST', 'JEST/JST', 'ECT', 'Sr. ECT', 'Lecturer']

export async function GET() {
  try {
    const { demographics, designations } = getSteadaData()

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
      gender: Object.entries(demographics.gender).map(([name, value]) => ({ name, value })),
      schoolType: Object.entries(demographics.schoolType).map(([name, value]) => ({ name, value })),
      designations: desigEntries.map(([name, value]) => ({ name, value })),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
