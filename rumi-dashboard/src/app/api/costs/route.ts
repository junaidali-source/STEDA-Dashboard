import { NextResponse } from 'next/server'
import { pool, filterParams, userWhere, dateWhere, organizationKeySql } from '@/lib/db'
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
    // Feature costs
    const featureQuery = `
      WITH costs AS (
        SELECT 'video' as f, COUNT(*)::int as cnt FROM video_requests vr
        JOIN users u ON vr.user_id = u.id
        WHERE vr.status = 'completed' AND ${userWhere('u')} ${dateWhere('vr')}

        UNION ALL

        SELECT 'lesson_plan', COUNT(*)::int FROM lesson_plan_requests lp
        JOIN users u ON lp.user_id = u.id
        WHERE lp.status = 'completed' AND ${userWhere('u')} ${dateWhere('lp')}

        UNION ALL

        SELECT 'coaching', COUNT(*)::int FROM coaching_sessions cs
        JOIN users u ON cs.user_id = u.id
        WHERE cs.status = 'completed' AND ${userWhere('u')} ${dateWhere('cs')}

        UNION ALL

        SELECT 'reading', COUNT(*)::int FROM reading_assessments ra
        JOIN users u ON ra.user_id = u.id
        WHERE ra.status = 'completed' AND ${userWhere('u')} ${dateWhere('ra')}
      )
      SELECT f as feature, cnt as count FROM costs
    `

    const featureRes = await pool.query(featureQuery, p)
    const featureCosts = featureRes.rows.map((row: any) => {
      const unitCost = COST_MODEL[row.feature as keyof typeof COST_MODEL] || 0
      return {
        feature: row.feature,
        count: row.count,
        unit_cost: unitCost,
        total_cost: row.count * unitCost,
      }
    })

    // Partner costs
    const partnerQuery = `
      SELECT
        ${organizationKeySql('u')} as org_key,
        COALESCE(NULLIF(u.organization, ''), 'Unspecified') as organization,
        COUNT(DISTINCT CASE WHEN vr.id IS NOT NULL THEN vr.id END) as videos,
        COUNT(DISTINCT CASE WHEN lp.id IS NOT NULL THEN lp.id END) as lessons,
        COUNT(DISTINCT CASE WHEN cs.id IS NOT NULL THEN cs.id END) as coaching,
        COUNT(DISTINCT CASE WHEN ra.id IS NOT NULL THEN ra.id END) as reading
      FROM users u
      LEFT JOIN video_requests vr ON u.id = vr.user_id AND vr.status = 'completed' AND ${dateWhere('vr')}
      LEFT JOIN lesson_plan_requests lp ON u.id = lp.user_id AND lp.status = 'completed' AND ${dateWhere('lp')}
      LEFT JOIN coaching_sessions cs ON u.id = cs.user_id AND cs.status = 'completed' AND ${dateWhere('cs')}
      LEFT JOIN reading_assessments ra ON u.id = ra.user_id AND ra.status = 'completed' AND ${dateWhere('ra')}
      WHERE ${userWhere('u')}
      GROUP BY u.organization
      HAVING COUNT(DISTINCT vr.id) > 0 OR COUNT(DISTINCT lp.id) > 0 OR COUNT(DISTINCT cs.id) > 0 OR COUNT(DISTINCT ra.id) > 0
      ORDER BY COUNT(DISTINCT vr.id) * 2.09 + COUNT(DISTINCT lp.id) * 0.32 + COUNT(DISTINCT cs.id) * 0.23 + COUNT(DISTINCT ra.id) * 0.02 DESC
    `

    const partnerRes = await pool.query(partnerQuery, p)
    const partnerCosts = partnerRes.rows.map((row: any) => ({
      organization: row.organization,
      videos: row.videos || 0,
      lessons: row.lessons || 0,
      coaching: row.coaching || 0,
      reading: row.reading || 0,
      total_cost: (row.videos || 0) * 2.09 + (row.lessons || 0) * 0.32 + (row.coaching || 0) * 0.23 + (row.reading || 0) * 0.02,
    }))

    // Country costs
    const countryQuery = `
      SELECT
        LEFT(u.phone_number, 2) as country_code,
        COUNT(DISTINCT CASE WHEN vr.id IS NOT NULL THEN vr.id END) as videos,
        COUNT(DISTINCT CASE WHEN lp.id IS NOT NULL THEN lp.id END) as lessons,
        COUNT(DISTINCT CASE WHEN cs.id IS NOT NULL THEN cs.id END) as coaching,
        COUNT(DISTINCT CASE WHEN ra.id IS NOT NULL THEN ra.id END) as reading
      FROM users u
      LEFT JOIN video_requests vr ON u.id = vr.user_id AND vr.status = 'completed' AND ${dateWhere('vr')}
      LEFT JOIN lesson_plan_requests lp ON u.id = lp.user_id AND lp.status = 'completed' AND ${dateWhere('lp')}
      LEFT JOIN coaching_sessions cs ON u.id = cs.user_id AND cs.status = 'completed' AND ${dateWhere('cs')}
      LEFT JOIN reading_assessments ra ON u.id = ra.user_id AND ra.status = 'completed' AND ${dateWhere('ra')}
      WHERE ${userWhere('u')}
      GROUP BY LEFT(u.phone_number, 2)
      ORDER BY COUNT(DISTINCT vr.id) + COUNT(DISTINCT lp.id) + COUNT(DISTINCT cs.id) + COUNT(DISTINCT ra.id) DESC
    `

    const countryRes = await pool.query(countryQuery, p)
    const countryCosts = countryRes.rows.map((row: any) => ({
      country_code: row.country_code || 'Unknown',
      videos: row.videos || 0,
      lessons: row.lessons || 0,
      coaching: row.coaching || 0,
      reading: row.reading || 0,
      total_cost: (row.videos || 0) * 2.09 + (row.lessons || 0) * 0.32 + (row.coaching || 0) * 0.23 + (row.reading || 0) * 0.02,
    }))

    // Daily costs
    const dailyQuery = `
      SELECT
        DATE(COALESCE(vr.created_at, lp.created_at, cs.created_at, ra.created_at)) as date,
        COUNT(DISTINCT vr.id) as videos,
        COUNT(DISTINCT lp.id) as lessons,
        COUNT(DISTINCT cs.id) as coaching,
        COUNT(DISTINCT ra.id) as reading
      FROM users u
      LEFT JOIN video_requests vr ON u.id = vr.user_id AND vr.status = 'completed' AND ${dateWhere('vr')}
      LEFT JOIN lesson_plan_requests lp ON u.id = lp.user_id AND lp.status = 'completed' AND ${dateWhere('lp')}
      LEFT JOIN coaching_sessions cs ON u.id = cs.user_id AND cs.status = 'completed' AND ${dateWhere('cs')}
      LEFT JOIN reading_assessments ra ON u.id = ra.user_id AND ra.status = 'completed' AND ${dateWhere('ra')}
      WHERE ${userWhere('u')}
      GROUP BY DATE(COALESCE(vr.created_at, lp.created_at, cs.created_at, ra.created_at))
      ORDER BY date DESC
      LIMIT 30
    `

    const dailyRes = await pool.query(dailyQuery, p)
    const dailyCosts = dailyRes.rows.map((row: any) => ({
      date: row.date,
      videos: row.videos || 0,
      lessons: row.lessons || 0,
      coaching: row.coaching || 0,
      reading: row.reading || 0,
      total_cost: (row.videos || 0) * 2.09 + (row.lessons || 0) * 0.32 + (row.coaching || 0) * 0.23 + (row.reading || 0) * 0.02,
    })).reverse()

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
