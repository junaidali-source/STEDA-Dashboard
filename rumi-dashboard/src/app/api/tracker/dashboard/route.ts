import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [snapshotRes, milestonesRes, actionsRes, targetsRes] = await Promise.all([
      pool.query(`SELECT * FROM metric_snapshots ORDER BY snapshot_date DESC LIMIT 1`),
      pool.query(`SELECT * FROM plan_milestones ORDER BY sort_order`),
      pool.query(`SELECT ai.*, mm.title AS meeting_title, mm.meeting_date FROM action_items ai LEFT JOIN meeting_minutes mm ON mm.id = ai.meeting_id ORDER BY ai.due_date ASC NULLS LAST LIMIT 50`),
      pool.query(`SELECT * FROM kpi_targets`),
    ])
    return NextResponse.json({
      snapshot:   snapshotRes.rows[0]   ?? null,
      milestones: milestonesRes.rows,
      actions:    actionsRes.rows,
      targets:    targetsRes.rows,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
