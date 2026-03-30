export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/auth'
import KPICard from '@/components/tracker/KPICard'
import PlanTimeline from '@/components/tracker/PlanTimeline'
import Link from 'next/link'

async function getData() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tracker/dashboard`, { cache: 'no-store' })
    return res.ok ? res.json() : { snapshot: null, milestones: [], actions: [], targets: [] }
  } catch { return { snapshot: null, milestones: [], actions: [], targets: [] } }
}

export default async function TrackerPage() {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  const { snapshot: sn, milestones, actions, targets } = await getData()
  const targetMap = Object.fromEntries((targets ?? []).map((t: { metric_key: string; target_value: number }) => [t.metric_key, t.target_value]))
  const openActions = (actions ?? []).filter((a: { status: string }) => a.status === 'open').slice(0, 8)

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">STEDA × Rumi Deployment Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">
            {sn?.snapshot_date ? `Latest snapshot: ${sn.snapshot_date}` : 'No snapshots yet'} ·
            <Link href="/tracker/metrics" className="text-indigo-400 hover:text-indigo-300 ml-1">Add snapshot →</Link>
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/tracker/meetings" className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-2 rounded-lg border border-gray-700">Meetings</Link>
          <Link href="/tracker/actions"  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-2 rounded-lg border border-gray-700">Actions</Link>
          <Link href="/tracker/reports"  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg">Generate Report</Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Teachers Joined"  value={sn?.teachers_joined  ?? null} target={targetMap.joined_pct    ? Math.round((targetMap.joined_pct/100) * (sn?.teachers_listed || 1346)) : undefined} sub={sn ? `${sn.joined_pct}% of ${sn.teachers_listed || 1346}` : undefined} />
        <KPICard label="Joined %"         value={sn?.joined_pct       ?? null} target={targetMap.joined_pct}    unit="%" />
        <KPICard label="Used Any Feature" value={sn?.used_any_pct     ?? null} target={targetMap.used_any_pct}  unit="%" sub={sn ? `${sn.used_any_feature} teachers` : undefined} />
        <KPICard label="Coaching Teachers"value={sn?.coaching_teachers ?? null} target={targetMap.coaching_pct  ? Math.round((targetMap.coaching_pct/100) * (sn?.teachers_joined || 1)) : undefined} sub="using coaching feature" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="LP Teachers"      value={sn?.lp_teachers      ?? null} sub={sn ? `${sn.lp_requests} requests` : undefined} />
        <KPICard label="LP Completion"    value={sn?.lp_completion    ?? null} target={targetMap.lp_completion}  unit="%" />
        <KPICard label="Video Teachers"   value={sn?.video_teachers   ?? null} sub={sn ? `${sn.video_completion}% completion` : undefined} />
        <KPICard label="Community Members"value={sn?.community_members ?? null} />
      </div>

      {/* Timeline + Open Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold text-sm">Deployment Plan</h2>
          </div>
          {milestones.length === 0
            ? <p className="text-gray-500 text-xs">No milestones. Run the SQL seed in Supabase.</p>
            : <PlanTimeline milestones={milestones} />}
        </div>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold text-sm">Open Actions</h2>
            <Link href="/tracker/actions" className="text-xs text-indigo-400 hover:text-indigo-300">View all →</Link>
          </div>
          {openActions.length === 0
            ? <p className="text-gray-500 text-xs">No open actions. Pull meetings from Gmail to populate.</p>
            : <div className="space-y-3">
                {openActions.map((a: { id: string; text: string; owner: string; due_date: string; priority: string }) => (
                  <div key={a.id} className="flex items-start gap-3">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${a.priority === 'high' ? 'bg-red-400' : a.priority === 'medium' ? 'bg-amber-400' : 'bg-gray-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-200 truncate">{a.text}</p>
                      <p className="text-xs text-gray-500">{a.owner} · {a.due_date || 'No due date'}</p>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  )
}
