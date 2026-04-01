export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import IngestButton from '@/components/tracker/IngestButton'
import Link from 'next/link'

export default async function MeetingsPage() {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  const { data } = await supabase
    .from('meeting_minutes')
    .select('*, action_items(id, status)')
    .order('meeting_date', { ascending: false })

  const meetings = (data ?? []).map((m: Record<string, unknown>) => {
    const actions = (m.action_items as { id: string; status: string }[]) ?? []
    return { ...m, action_items: undefined, action_count: actions.length, open_count: actions.filter(a => a.status === 'open').length }
  }) as Array<{ id: string; title: string; meeting_date: string; participants: string[]; action_count: number; open_count: number; fathom_url: string }>

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Meeting Minutes</h1>
          <p className="text-sm text-gray-500 mt-1">{meetings.length} Fathom meeting(s) parsed</p>
        </div>
        <IngestButton />
      </div>

      {meetings.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400 text-sm">No meetings ingested yet.</p>
          <p className="text-gray-600 text-xs mt-1">Click &quot;Pull from Gmail&quot; to import Fathom recap emails.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {meetings.map(m => (
            <Link key={m.id} href={`/tracker/meetings/${m.id}`}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors block">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white font-medium text-sm">{m.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {m.meeting_date} · {m.participants?.length ?? 0} participants
                  </p>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-gray-400">{m.action_count} actions</span>
                  {m.open_count > 0 && <span className="text-amber-400">{m.open_count} open</span>}
                  {m.fathom_url && (
                    <a href={m.fathom_url} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-indigo-400 hover:text-indigo-300">Recording →</a>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
