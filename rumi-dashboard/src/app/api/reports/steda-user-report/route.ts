import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    // Query all users with engagement data
    const usersQuery = `
      SELECT
        u.id,
        u.name,
        u.phone_number,
        u.phone_primary,
        u.region,
        u.subjects,
        COUNT(DISTINCT CASE WHEN cs.id IS NOT NULL THEN cs.id END)::int as coaching_session_count,
        MAX(cs.session_date) as last_coaching_date,
        COUNT(DISTINCT ra.id)::int as reading_assessment_count,
        COUNT(DISTINCT lpr.id)::int as lesson_plan_count,
        COUNT(DISTINCT ia.id)::int as image_analysis_count,
        COUNT(DISTINCT vr.id)::int as video_request_count
      FROM users u
      LEFT JOIN coaching_sessions cs ON u.id = cs.user_id
      LEFT JOIN reading_assessments ra ON u.id = ra.user_id
      LEFT JOIN lesson_plan_requests lpr ON u.id = lpr.user_id
      LEFT JOIN image_analysis_requests ia ON u.id = ia.user_id
      LEFT JOIN video_requests vr ON u.id = vr.user_id
      GROUP BY u.id, u.name, u.phone_number, u.phone_primary, u.region, u.subjects
      ORDER BY (COUNT(DISTINCT CASE WHEN cs.id IS NOT NULL THEN cs.id END) + COUNT(DISTINCT ra.id) + COUNT(DISTINCT lpr.id) + COUNT(DISTINCT ia.id) + COUNT(DISTINCT vr.id)) DESC
    `;

    const result = await pool.query(usersQuery)

    return NextResponse.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    console.error('Error fetching user report data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user report data' },
      { status: 500 }
    )
  }
}
