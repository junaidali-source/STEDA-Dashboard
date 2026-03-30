export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { verifySessionToken } from '@/lib/auth'
import Link from 'next/link'

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  let meeting = null
  let actions: Array<{ id: string; text: string; owner: string; due_date: string; priority: string; status: string; category: string }> = []

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tracker/meetings/${params.id}`, { cache: 'no-store' })
    if (res.status === 404) notFound()
    const data = await res.json()
    meeting = data.meeting
    actions = data.actions
  } catch { notFound() }

  const PRIORITY_COLORS: Record<string, string> = { high: 'text-red-400', medium: 'text-amber-400', low: 'text-emerald-400' }
  const STATUS_COLORS:   Record<string, string> = { open: 'text-blue-400', done: 'text-emerald-400', blocked: 'text-red-400' }

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tracker/meetings" className="text-xs text-gray-500 hover:text-gray-300">← Meetings</Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{meeting.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {meeting.meeting_date} · {meeting.participants?.join(', ')}
            </p>
          </div>
          {meeting.fathom_url && (
            <a href={meeting.fathom_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-800 px-3 py-1.5 rounded-lg">
              Watch Recording →
            </a>
          )}
        </div>
        {meeting.summary && (
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">Summary</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{meeting.summary}</p>
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold text-sm mb-4">Action Items ({actions.length})</h2>
        {actions.length === 0 ? (
          <p className="text-gray-500 text-xs">No action items extracted.</p>
        ) : (
          <div className="space-y-3">
            {actions.map(a => (
              <div key={a.id} className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-0">
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${a.priority === 'high' ? 'bg-red-400' : a.priority === 'medium' ? 'bg-amber-400' : 'bg-gray-500'}`} />
                <div className="flex-1">
                  <p className="text-xs text-gray-200">{a.text}</p>
                  <div className="flex gap-3 mt-1 text-xs">
                    <span className="text-gray-500">{a.owner || '—'}</span>
                    <span className="text-gray-600">{a.due_date || 'No due date'}</span>
                    <span className={PRIORITY_COLORS[a.priority] ?? 'text-gray-400'}>{a.priority}</span>
                    <span className={STATUS_COLORS[a.status] ?? 'text-gray-400'}>{a.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
