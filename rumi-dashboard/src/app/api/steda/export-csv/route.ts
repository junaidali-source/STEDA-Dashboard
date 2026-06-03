import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getFilteredStedaPhones, stedaScopeFromSearchParams } from '@/lib/steda-scope'

export const dynamic = 'force-dynamic'

function escapeCSV(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return ''
  const s = String(str)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams
    const { region, district } = stedaScopeFromSearchParams(sp)

    const phones = await getFilteredStedaPhones(region, district)
    if (phones.length === 0) {
      return new NextResponse('phone_number,name,school,region\n', {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="steda-rumi-export.csv"' }
      })
    }

    // Simple fast query - just user basics, no date filtering
    const { rows } = await pool.query(
      `SELECT
         u.phone_number,
         COALESCE(u.name, '') AS name,
         COALESCE(u.school_name, '') AS school_name,
         COALESCE(u.region, '') AS region,
         COALESCE(u.lesson_plans_count, 0)::int AS lesson_plans,
         COALESCE(u.coaching_sessions_count, 0)::int AS coaching,
         COALESCE(u.reading_assessments_count, 0)::int AS reading,
         COALESCE(u.videos_count, 0)::int AS video,
         COALESCE(u.quizzes_count, 0)::int AS quizzes
       FROM users u
       WHERE u.phone_number = ANY($1::text[]) AND COALESCE(u.is_test_user, false) = false
       ORDER BY u.lesson_plans_count DESC NULLS LAST`,
      [phones]
    )

    const headers = ['Phone Number', 'Name', 'School', 'Region', 'Lesson Plans', 'Coaching', 'Reading', 'Video', 'Quizzes']
    const csv = [headers.map(escapeCSV).join(',')]

    for (const row of rows) {
      csv.push([
        escapeCSV(row.phone_number),
        escapeCSV(row.name),
        escapeCSV(row.school_name),
        escapeCSV(row.region),
        row.lesson_plans,
        row.coaching,
        row.reading,
        row.video,
        row.quizzes,
      ].join(','))
    }

    const filename = `steda-rumi-export-${new Date().toISOString().slice(0, 10)}.csv`
    return new NextResponse(csv.join('\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` }
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
