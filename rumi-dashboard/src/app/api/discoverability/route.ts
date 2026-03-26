import { NextResponse } from 'next/server'
import { pool, userWhere, dateWhere, filterParams } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const p = filterParams(req.url)
  try {
    const { rows } = await pool.query(
      `SELECT
        fs.suggested_feature,
        COUNT(*)::int                                                  AS shown,
        COUNT(*) FILTER (WHERE fs.was_clicked)::int                    AS clicked,
        COUNT(*) FILTER (WHERE fs.led_to_feature_use)::int             AS converted,
        ROUND(
          (100.0 * COUNT(*) FILTER (WHERE fs.was_clicked)
          / NULLIF(COUNT(*), 0))::numeric, 1
        )                                                              AS click_rate,
        ROUND(
          (100.0 * COUNT(*) FILTER (WHERE fs.led_to_feature_use)
          / NULLIF(COUNT(*) FILTER (WHERE fs.was_clicked), 0))::numeric, 1
        )                                                              AS convert_rate
      FROM feature_suggestions fs
      JOIN users u ON fs.user_id = u.id
      WHERE ${userWhere()} ${dateWhere('fs')}
      GROUP BY fs.suggested_feature
      ORDER BY shown DESC`,
      p
    )
    return NextResponse.json(rows)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
