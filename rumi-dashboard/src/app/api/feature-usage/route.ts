import { NextResponse } from 'next/server'
import { pool, userWhere, dateWhere, filterParams } from '@/lib/db'

export async function GET(req: Request) {
  const p = filterParams(req.url)
  const w = userWhere()
  const d = dateWhere('t')
  try {
    const { rows } = await pool.query(
      `SELECT feature, count FROM (
        SELECT 'Lesson Plans'         AS feature, COUNT(*)::int AS count
        FROM lesson_plan_requests t JOIN users u ON t.user_id = u.id
        WHERE t.status = 'completed' AND ${w} ${d}
        UNION ALL
        SELECT 'Coaching Sessions',   COUNT(*)::int
        FROM coaching_sessions t JOIN users u ON t.user_id = u.id
        WHERE t.status = 'completed' AND ${w} ${d}
        UNION ALL
        SELECT 'Reading Assessments', COUNT(*)::int
        FROM reading_assessments t JOIN users u ON t.user_id = u.id
        WHERE t.status = 'completed' AND ${w} ${d}
        UNION ALL
        SELECT 'Video Requests',      COUNT(*)::int
        FROM video_requests t JOIN users u ON t.user_id = u.id
        WHERE t.status = 'completed' AND ${w} ${d}
        UNION ALL
        SELECT 'Image Analysis',      COUNT(*)::int
        FROM image_analysis_requests t JOIN users u ON t.user_id = u.id
        WHERE t.status = 'completed' AND ${w} ${d}
      ) sub
      ORDER BY count DESC`,
      p
    )
    return NextResponse.json(rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
