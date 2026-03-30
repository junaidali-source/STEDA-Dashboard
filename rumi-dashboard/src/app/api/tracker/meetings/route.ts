import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data: meetings, error } = await supabase
      .from('meeting_minutes')
      .select('*, action_items(id, status)')
      .order('meeting_date', { ascending: false })

    if (error) throw error

    const rows = (meetings ?? []).map((m: Record<string, unknown>) => {
      const actions = (m.action_items as { id: string; status: string }[]) ?? []
      return {
        ...m,
        action_items: undefined,
        action_count: actions.length,
        open_count:   actions.filter(a => a.status === 'open').length,
      }
    })

    return NextResponse.json(rows)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
