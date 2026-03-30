import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [{ data: meeting, error: me }, { data: actions, error: ae }] = await Promise.all([
      supabase.from('meeting_minutes').select('*').eq('id', params.id).single(),
      supabase.from('action_items').select('*').eq('meeting_id', params.id)
        .order('due_date', { ascending: true, nullsFirst: false }),
    ])

    if (me || !meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (ae) throw ae

    return NextResponse.json({ meeting, actions: actions ?? [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
