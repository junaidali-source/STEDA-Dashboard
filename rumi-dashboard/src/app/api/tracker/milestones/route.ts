import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await pool.query(`SELECT * FROM plan_milestones ORDER BY sort_order`)
    return NextResponse.json(res.rows)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status, actual_result } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await pool.query(
      `UPDATE plan_milestones SET status=$1, actual_result=COALESCE($2, actual_result) WHERE id=$3`,
      [status, actual_result ?? null, id]
    )
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
