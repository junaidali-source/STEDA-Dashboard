import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('plan_milestones')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status, actual_result } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const update: Record<string, string> = { status }
    if (actual_result != null) update.actual_result = actual_result

    const { error } = await supabase
      .from('plan_milestones')
      .update(update)
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
