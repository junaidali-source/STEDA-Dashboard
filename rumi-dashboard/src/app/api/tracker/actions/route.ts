import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sp      = new URL(req.url).searchParams
    const status  = sp.get('status')
    const owner   = sp.get('owner')
    const priority= sp.get('priority')

    const conditions: string[] = []
    const params: unknown[]    = []
    if (status)   { params.push(status);   conditions.push(`ai.status = $${params.length}`) }
    if (owner)    { params.push(owner);    conditions.push(`ai.owner ILIKE $${params.length}`) }
    if (priority) { params.push(priority); conditions.push(`ai.priority = $${params.length}`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const res = await pool.query(
      `SELECT ai.*, mm.title AS meeting_title, mm.meeting_date
       FROM action_items ai
       LEFT JOIN meeting_minutes mm ON mm.id = ai.meeting_id
       ${where}
       ORDER BY ai.due_date ASC NULLS LAST, ai.created_at DESC`,
      params
    )
    return NextResponse.json(res.rows)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json()
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 })
    await pool.query(`UPDATE action_items SET status = $1 WHERE id = $2`, [status, id])
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
