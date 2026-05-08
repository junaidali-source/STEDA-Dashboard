import { NextResponse } from 'next/server'
import { pool, filterParams, userWhere, dateWhere } from '@/lib/db'
import { verifySessionToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const COST_MODEL = {
  video: 2.09,
  lesson_plan: 0.32,
  coaching: 0.23,
  reading: 0.02,
}

function extractToken(req: Request): string | null {
  const cookie = req.headers.get('cookie')
  if (!cookie) return null
  const match = cookie.match(/session=([^;]+)/)
  return match ? match[1] : null
}

export async function GET(req: Request) {
  const token = extractToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await verifySessionToken(token)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const p = filterParams(req.url)

  try {
    // Separate queries for each feature to avoid parameter reuse issues
    const videoQuery = `
      SELECT COUNT(*)::int as cnt FROM video_requests vr
      JOIN users u ON vr.user_id = u.id
      WHERE vr.status = 'completed' AND ${userWhere('u')} ${dateWhere('vr')}
    `
    const videoRes = await pool.query(videoQuery, p)
    const videoCount = videoRes.rows[0]?.cnt || 0

    const lessonQuery = `
      SELECT COUNT(*)::int as cnt FROM lesson_plan_requests lp
      JOIN users u ON lp.user_id = u.id
      WHERE lp.status = 'completed' AND ${userWhere('u')} ${dateWhere('lp')}
    `
    const lessonRes = await pool.query(lessonQuery, p)
    const lessonCount = lessonRes.rows[0]?.cnt || 0

    const coachingQuery = `
      SELECT COUNT(*)::int as cnt FROM coaching_sessions cs
      JOIN users u ON cs.user_id = u.id
      WHERE cs.status = 'completed' AND ${userWhere('u')} ${dateWhere('cs')}
    `
    const coachingRes = await pool.query(coachingQuery, p)
    const coachingCount = coachingRes.rows[0]?.cnt || 0

    const readingQuery = `
      SELECT COUNT(*)::int as cnt FROM reading_assessments ra
      JOIN users u ON ra.user_id = u.id
      WHERE ra.status = 'completed' AND ${userWhere('u')} ${dateWhere('ra')}
    `
    const readingRes = await pool.query(readingQuery, p)
    const readingCount = readingRes.rows[0]?.cnt || 0

    // Get failure counts to show pipeline health
    const videoFailedQuery = `SELECT COUNT(*)::int as cnt FROM video_requests WHERE status != 'completed' AND ${userWhere('u')} ${dateWhere('vr')}`.replace('${userWhere(', `SELECT COUNT(*)::int as cnt FROM video_requests vr JOIN users u ON vr.user_id = u.id WHERE vr.status != 'completed' AND ${userWhere('u')} ${dateWhere('vr')}`).split('`SELECT')[1] ?
      await pool.query(`SELECT COUNT(*)::int as cnt FROM video_requests vr JOIN users u ON vr.user_id = u.id WHERE vr.status != 'completed' AND ${userWhere('u')} ${dateWhere('vr')}`, p)
      : { rows: [{ cnt: 0 }] }

    const videoFailedRes = await pool.query(
      `SELECT COUNT(*)::int as cnt FROM video_requests vr JOIN users u ON vr.user_id = u.id WHERE vr.status != 'completed' AND ${userWhere('u')} ${dateWhere('vr')}`,
      p
    )
    const videoFailed = videoFailedRes.rows[0]?.cnt || 0

    const lessonFailedRes = await pool.query(
      `SELECT COUNT(*)::int as cnt FROM lesson_plan_requests lp JOIN users u ON lp.user_id = u.id WHERE lp.status != 'completed' AND ${userWhere('u')} ${dateWhere('lp')}`,
      p
    )
    const lessonFailed = lessonFailedRes.rows[0]?.cnt || 0

    const coachingFailedRes = await pool.query(
      `SELECT COUNT(*)::int as cnt FROM coaching_sessions cs JOIN users u ON cs.user_id = u.id WHERE cs.status != 'completed' AND ${userWhere('u')} ${dateWhere('cs')}`,
      p
    )
    const coachingFailed = coachingFailedRes.rows[0]?.cnt || 0

    const readingFailedRes = await pool.query(
      `SELECT COUNT(*)::int as cnt FROM reading_assessments ra JOIN users u ON ra.user_id = u.id WHERE ra.status != 'completed' AND ${userWhere('u')} ${dateWhere('ra')}`,
      p
    )
    const readingFailed = readingFailedRes.rows[0]?.cnt || 0

    const featureCosts = [
      {
        feature: 'video',
        completed: videoCount,
        failed: videoFailed,
        completion_rate: videoCount + videoFailed > 0 ? ((videoCount / (videoCount + videoFailed)) * 100).toFixed(1) : 0,
        unit_cost: 2.09,
        total_cost: videoCount * 2.09
      },
      {
        feature: 'lesson_plan',
        completed: lessonCount,
        failed: lessonFailed,
        completion_rate: lessonCount + lessonFailed > 0 ? ((lessonCount / (lessonCount + lessonFailed)) * 100).toFixed(1) : 0,
        unit_cost: 0.32,
        total_cost: lessonCount * 0.32
      },
      {
        feature: 'coaching',
        completed: coachingCount,
        failed: coachingFailed,
        completion_rate: coachingCount + coachingFailed > 0 ? ((coachingCount / (coachingCount + coachingFailed)) * 100).toFixed(1) : 0,
        unit_cost: 0.23,
        total_cost: coachingCount * 0.23
      },
      {
        feature: 'reading',
        completed: readingCount,
        failed: readingFailed,
        completion_rate: readingCount + readingFailed > 0 ? ((readingCount / (readingCount + readingFailed)) * 100).toFixed(1) : 0,
        unit_cost: 0.02,
        total_cost: readingCount * 0.02
      },
    ]

    // Partner costs - no date filter (show costs across all time)
    const partnerQuery = `
      SELECT
        COALESCE(NULLIF(u.organization, ''), 'Unspecified') as organization,
        COUNT(DISTINCT CASE WHEN vr.id IS NOT NULL THEN vr.id END)::int as videos,
        COUNT(DISTINCT CASE WHEN lp.id IS NOT NULL THEN lp.id END)::int as lessons,
        COUNT(DISTINCT CASE WHEN cs.id IS NOT NULL THEN cs.id END)::int as coaching,
        COUNT(DISTINCT CASE WHEN ra.id IS NOT NULL THEN ra.id END)::int as reading
      FROM users u
      LEFT JOIN video_requests vr ON u.id = vr.user_id AND vr.status = 'completed'
      LEFT JOIN lesson_plan_requests lp ON u.id = lp.user_id AND lp.status = 'completed'
      LEFT JOIN coaching_sessions cs ON u.id = cs.user_id AND cs.status = 'completed'
      LEFT JOIN reading_assessments ra ON u.id = ra.user_id AND ra.status = 'completed'
      WHERE COALESCE(u.is_test_user, false) = false
        AND ($1 = 'all' OR LEFT(u.phone_number, 2) = $1)
        AND ($2 = '' OR u.school_name ILIKE $3)
        AND ($4 = '' OR u.organization = $4)
      GROUP BY u.organization
      ORDER BY COUNT(DISTINCT vr.id) * 2.09 + COUNT(DISTINCT lp.id) * 0.32 + COUNT(DISTINCT cs.id) * 0.23 + COUNT(DISTINCT ra.id) * 0.02 DESC
      LIMIT 20
    `

    const partnerRes = await pool.query(partnerQuery, p.slice(0, 4))
    const partnerCosts = partnerRes.rows.map((row: any) => ({
      organization: row.organization,
      videos: row.videos || 0,
      lessons: row.lessons || 0,
      coaching: row.coaching || 0,
      reading: row.reading || 0,
      total_cost: (row.videos || 0) * 2.09 + (row.lessons || 0) * 0.32 + (row.coaching || 0) * 0.23 + (row.reading || 0) * 0.02,
    }))

    // Country costs - no date filter (show costs across all time)
    const countryQuery = `
      SELECT
        LEFT(u.phone_number, 2) as country_code,
        COUNT(DISTINCT CASE WHEN vr.id IS NOT NULL THEN vr.id END)::int as videos,
        COUNT(DISTINCT CASE WHEN lp.id IS NOT NULL THEN lp.id END)::int as lessons,
        COUNT(DISTINCT CASE WHEN cs.id IS NOT NULL THEN cs.id END)::int as coaching,
        COUNT(DISTINCT CASE WHEN ra.id IS NOT NULL THEN ra.id END)::int as reading
      FROM users u
      LEFT JOIN video_requests vr ON u.id = vr.user_id AND vr.status = 'completed'
      LEFT JOIN lesson_plan_requests lp ON u.id = lp.user_id AND lp.status = 'completed'
      LEFT JOIN coaching_sessions cs ON u.id = cs.user_id AND cs.status = 'completed'
      LEFT JOIN reading_assessments ra ON u.id = ra.user_id AND ra.status = 'completed'
      WHERE COALESCE(u.is_test_user, false) = false
        AND ($1 = 'all' OR LEFT(u.phone_number, 2) = $1)
        AND ($2 = '' OR u.school_name ILIKE $3)
        AND ($4 = '' OR u.organization = $4)
      GROUP BY LEFT(u.phone_number, 2)
      ORDER BY COUNT(DISTINCT vr.id) + COUNT(DISTINCT lp.id) + COUNT(DISTINCT cs.id) + COUNT(DISTINCT ra.id) DESC
      LIMIT 20
    `

    const countryRes = await pool.query(countryQuery, p.slice(0, 4))
    const countryCosts = countryRes.rows.map((row: any) => ({
      country_code: row.country_code || 'Unknown',
      videos: row.videos || 0,
      lessons: row.lessons || 0,
      coaching: row.coaching || 0,
      reading: row.reading || 0,
      total_cost: (row.videos || 0) * 2.09 + (row.lessons || 0) * 0.32 + (row.coaching || 0) * 0.23 + (row.reading || 0) * 0.02,
    }))

    // Daily costs - last 30 days
    const dailyQuery = `
      SELECT
        DATE(created_at) as date,
        'video' as type,
        COUNT(*)::int as cnt
      FROM video_requests
      WHERE status = 'completed' AND ($5 = '' OR created_at >= $5::timestamptz) AND ($6 = '' OR created_at < ($6::date + INTERVAL '1 day')::timestamptz)
      GROUP BY DATE(created_at)
      UNION ALL
      SELECT DATE(created_at), 'lesson_plan', COUNT(*)::int FROM lesson_plan_requests
      WHERE status = 'completed' AND ($5 = '' OR created_at >= $5::timestamptz) AND ($6 = '' OR created_at < ($6::date + INTERVAL '1 day')::timestamptz)
      GROUP BY DATE(created_at)
      UNION ALL
      SELECT DATE(created_at), 'coaching', COUNT(*)::int FROM coaching_sessions
      WHERE status = 'completed' AND ($5 = '' OR created_at >= $5::timestamptz) AND ($6 = '' OR created_at < ($6::date + INTERVAL '1 day')::timestamptz)
      GROUP BY DATE(created_at)
      UNION ALL
      SELECT DATE(created_at), 'reading', COUNT(*)::int FROM reading_assessments
      WHERE status = 'completed' AND ($5 = '' OR created_at >= $5::timestamptz) AND ($6 = '' OR created_at < ($6::date + INTERVAL '1 day')::timestamptz)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 120
    `

    const dailyRes = await pool.query(dailyQuery, p.slice(4, 6))
    const dailyMap = new Map<string, any>()
    dailyRes.rows.forEach((row: any) => {
      const key = row.date.toString()
      if (!dailyMap.has(key)) {
        dailyMap.set(key, { date: key, videos: 0, lessons: 0, coaching: 0, reading: 0 })
      }
      const day = dailyMap.get(key)
      if (row.type === 'video') day.videos = row.cnt
      else if (row.type === 'lesson_plan') day.lessons = row.cnt
      else if (row.type === 'coaching') day.coaching = row.cnt
      else if (row.type === 'reading') day.reading = row.cnt
    })

    const dailyCosts = Array.from(dailyMap.values()).map((d: any) => ({
      ...d,
      total_cost: d.videos * 2.09 + d.lessons * 0.32 + d.coaching * 0.23 + d.reading * 0.02,
    }))

    const totalCost = featureCosts.reduce((sum: number, f: any) => sum + f.total_cost, 0)

    return NextResponse.json({
      total_cost: parseFloat(totalCost.toFixed(2)),
      cost_model: COST_MODEL,
      feature_costs: featureCosts,
      partner_costs: partnerCosts,
      country_costs: countryCosts,
      daily_costs: dailyCosts,
    })
  } catch (error) {
    console.error('Cost API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Database error' },
      { status: 500 }
    )
  }
}
