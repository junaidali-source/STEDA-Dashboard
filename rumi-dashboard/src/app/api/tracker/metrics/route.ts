import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await pool.query(`SELECT * FROM metric_snapshots ORDER BY snapshot_date DESC LIMIT 52`)
    return NextResponse.json(res.rows)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const fields = [
      'snapshot_date','teachers_listed','teachers_joined','joined_pct',
      'used_any_feature','used_any_pct','total_requests','completion_pct',
      'lp_teachers','lp_requests','lp_completion','coaching_teachers',
      'video_teachers','video_completion','image_teachers',
      'depth_0','depth_1','depth_2','depth_3','community_members','source',
    ]
    const cols   = fields.filter(f => body[f] !== undefined)
    const vals   = cols.map(f => body[f])
    const placeholders = cols.map((_, i) => `$${i + 1}`)
    await pool.query(
      `INSERT INTO metric_snapshots (${cols.join(',')}) VALUES (${placeholders.join(',')})`,
      vals
    )
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
