import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('wa_heartbeat')
      .select('updated_at, qr_code, wa_status, groups')
      .eq('id', 1)
      .single()

    if (error || !data) {
      return NextResponse.json({ status: 'offline', qr_code: null, groups: [] })
    }

    // Consider 'connected' only if heartbeat was updated within 2 minutes
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const recentlyAlive = data.updated_at > twoMinAgo

    const status =
      data.wa_status === 'connected' && recentlyAlive ? 'connected' :
      data.wa_status === 'waiting_for_qr' ? 'waiting_for_qr' :
      data.wa_status === 'authenticated' ? 'authenticated' :
      'offline'

    return NextResponse.json({
      status,
      qr_code: data.qr_code ?? null,
      groups:  Array.isArray(data.groups) ? data.groups : [],
      updated_at: data.updated_at,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
