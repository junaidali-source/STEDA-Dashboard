import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getFilteredStedaPhones, stedaScopeFromSearchParams } from '@/lib/steda-scope'

export const dynamic = 'force-dynamic'

// CSV export with correct column mapping
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
    const from = sp.get('from') || null
    const to = sp.get('to') || null
    const { region, district } = stedaScopeFromSearchParams(sp)

    const phones = await getFilteredStedaPhones(region, district)
    if (phones.length === 0) {
      return new NextResponse('phone_number,name,district,school,lesson_plans,coaching,reading,video,image,total_features\n', {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="steda-rumi-export.csv"' }
      })
    }

    const dc = `AND ($2::date IS NULL OR u.created_at::date >= $2::date) AND ($3::date IS NULL OR u.created_at::date <= $3::date)`
    const p = [phones, from, to]

    const { rows } = await pool.query(
      `SELECT
         u.phone_number,
         COALESCE(u.name, '') AS name,
         u.school_name,
         u.region,
         COUNT(DISTINCT CASE WHEN lp.status='completed' THEN lp.id END)::int AS lesson_plans,
         COUNT(DISTINCT CASE WHEN cs.status='completed' THEN cs.id END)::int AS coaching,
         COUNT(DISTINCT CASE WHEN ra.status='completed' THEN ra.id END)::int AS reading,
         COUNT(DISTINCT vr.id)::int AS video,
         COUNT(DISTINCT ia.id)::int AS image,
         (CASE WHEN COUNT(DISTINCT lp.id) FILTER(WHERE lp.status='completed') > 0 THEN 1 ELSE 0 END +
          CASE WHEN COUNT(DISTINCT cs.id) FILTER(WHERE cs.status='completed') > 0 THEN 1 ELSE 0 END +
          CASE WHEN COUNT(DISTINCT ra.id) FILTER(WHERE ra.status='completed') > 0 THEN 1 ELSE 0 END +
          CASE WHEN COUNT(DISTINCT vr.id) > 0 THEN 1 ELSE 0 END +
          CASE WHEN COUNT(DISTINCT ia.id) > 0 THEN 1 ELSE 0 END)::int AS total_features
       FROM users u
       LEFT JOIN lesson_plan_requests lp ON lp.user_id=u.id ${dc.replace(/u\./g, 'lp.')}
       LEFT JOIN coaching_sessions cs ON cs.user_id=u.id ${dc.replace(/u\./g, 'cs.')}
       LEFT JOIN reading_assessments ra ON ra.user_id=u.id ${dc.replace(/u\./g, 'ra.')}
       LEFT JOIN video_requests vr ON vr.user_id=u.id ${dc.replace(/u\./g, 'vr.')}
       LEFT JOIN image_analysis_requests ia ON ia.user_id=u.id ${dc.replace(/u\./g, 'ia.')}
       WHERE u.phone_number = ANY($1::text[]) AND COALESCE(u.is_test_user, false) = false
       GROUP BY u.id, u.phone_number, u.full_name, u.school_name, u.region
       ORDER BY total_features DESC, u.full_name`,
      p
    )

    const headers = ['Phone Number', 'Name', 'School', 'District/Region', 'Lesson Plans', 'Coaching', 'Reading', 'Video', 'Image', 'Total Features']
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
        row.image,
        row.total_features,
      ].map(escapeCSV).join(','))
    }

    const filename = `steda-rumi-export-${new Date().toISOString().slice(0, 10)}.csv`
    return new NextResponse(csv.join('\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` }
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
