import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [meetingRes, actionsRes] = await Promise.all([
      pool.query(`SELECT * FROM meeting_minutes WHERE id = $1`, [params.id]),
      pool.query(`SELECT * FROM action_items WHERE meeting_id = $1 ORDER BY priority DESC, due_date ASC NULLS LAST`, [params.id]),
    ])
    if (!meetingRes.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ meeting: meetingRes.rows[0], actions: actionsRes.rows })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
