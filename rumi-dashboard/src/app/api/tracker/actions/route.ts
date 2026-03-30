import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sp       = new URL(req.url).searchParams
    const status   = sp.get('status')
    const priority = sp.get('priority')

    let query = supabase
      .from('action_items')
      .select('*, meeting_minutes(title, meeting_date)')
      .order('due_date', { ascending: true, nullsFirst: false })

    if (status)   query = query.eq('status', status)
    if (priority) query = query.eq('priority', priority)

    const { data, error } = await query
    if (error) throw error

    // Flatten meeting join to match existing shape
    const rows = (data ?? []).map((r: Record<string, unknown>) => {
      const mm = r.meeting_minutes as { title?: string; meeting_date?: string } | null
      return { ...r, meeting_title: mm?.title ?? null, meeting_date: mm?.meeting_date ?? null, meeting_minutes: undefined }
    })

    return NextResponse.json(rows)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json()
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 })

    const { error } = await supabase
      .from('action_items')
      .update({ status })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
