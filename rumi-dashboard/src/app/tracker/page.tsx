export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/auth'
import { pool } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { getSteadaData } from '@/lib/steda-phones'
import KPICard from '@/components/tracker/KPICard'
import PlanTimeline from '@/components/tracker/PlanTimeline'
import Link from 'next/link'

async function getLiveMetrics() {
  try {
    const { phones, teachers } = getSteadaData()
    const totalListed = teachers.length
    if (!phones.length) return null

    const joinedRes = await pool.query(
      `SELECT id FROM users WHERE phone_number = ANY($1::text[]) AND COALESCE(is_test_user,false)=false`,
      [phones]
    )
    const ids: string[] = joinedRes.rows.map((r: { id: string }) => r.id)
    const totalJoined = ids.length
    if (!ids.length) return null

    const [lpRes, csRes, vrRes, iaRes, anyRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER(WHERE status='completed')::int AS completed, COUNT(DISTINCT user_id)::int AS users FROM lesson_plan_requests WHERE user_id=ANY($1::uuid[])`, [ids]),
      pool.query(`SELECT COUNT(DISTINCT user_id)::int AS users FROM coaching_sessions WHERE user_id=ANY($1::uuid[])`, [ids]),
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER(WHERE status='completed')::int AS completed, COUNT(DISTINCT user_id)::int AS users FROM video_requests WHERE user_id=ANY($1::uuid[])`, [ids]),
      pool.query(`SELECT COUNT(DISTINCT user_id)::int AS users FROM image_analysis_requests WHERE user_id=ANY($1::uuid[])`, [ids]),
      pool.query(`SELECT COUNT(DISTINCT user_id)::int AS any_feature_users FROM (
        SELECT user_id FROM lesson_plan_requests WHERE user_id=ANY($1::uuid[])
        UNION SELECT user_id FROM coaching_sessions WHERE user_id=ANY($1::uuid[])
        UNION SELECT user_id FROM video_requests WHERE user_id=ANY($1::uuid[])
        UNION SELECT user_id FROM image_analysis_requests WHERE user_id=ANY($1::uuid[])
      ) sub`, [ids]),
    ])

    const lp   = lpRes.rows[0]
    const vr   = vrRes.rows[0]
    const usedAny = anyRes.rows[0].any_feature_users ?? 0

    let communityMembers: number | null = null
    try {
      const { data } = await supabase.from('whatsapp_messages').select('sender_phone')
      if (data) communityMembers = new Set(data.map((r: { sender_phone: string }) => r.sender_phone)).size
    } catch { /* ignore */ }

    return {
      teachers_listed:   totalListed,
      teachers_joined:   totalJoined,
      joined_pct:        Math.round((totalJoined / totalListed) * 100),
      used_any_feature:  usedAny,
      used_any_pct:      Math.round((usedAny / totalJoined) * 100),
      lp_teachers:       lp.users ?? 0,
      lp_requests:       lp.total ?? 0,
      lp_completion:     lp.total > 0 ? Math.round((lp.completed / lp.total) * 100) : 0,
      coaching_teachers: csRes.rows[0].users ?? 0,
      video_teachers:    vr.users ?? 0,
      video_completion:  vr.total > 0 ? Math.round((vr.completed / vr.total) * 100) : 0,
      image_teachers:    iaRes.rows[0].users ?? 0,
      community_members: communityMembers,
    }
  } catch { return null }
}

export default async function TrackerPage() {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  const [sn, milestonesData, actionsData, targetsData] = await Promise.all([
    getLiveMetrics(),
    supabase.from('plan_milestones').select('*').order('sort_order').then(r => r.data ?? []),
    supabase.from('action_items').select('*').eq('status', 'open')
      .order('due_date', { ascending: true, nullsFirst: false }).limit(8)
      .then(r => r.data ?? []),
    supabase.from('kpi_targets').select('*').then(r => r.data ?? []),
  ])

  const targetMap = Object.fromEntries(
    (targetsData as { metric_key: string; target_value: number }[]).map(t => [t.metric_key, t.target_value])
  )

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">STEDA × Rumi Deployment Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live data · auto-saves daily snapshot
            </span>
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
        <KPICard label="Teachers Joined"   value={sn?.teachers_joined  ?? null} target={targetMap.joined_pct ? Math.round((targetMap.joined_pct/100)*(sn?.teachers_listed||1346)) : undefined} sub={sn ? `${sn.joined_pct}% of ${sn.teachers_listed}` : undefined} />
        <KPICard label="Joined %"          value={sn?.joined_pct       ?? null} target={targetMap.joined_pct}   unit="%" />
        <KPICard label="Used Any Feature"  value={sn?.used_any_pct     ?? null} target={targetMap.used_any_pct} unit="%" sub={sn ? `${sn.used_any_feature} teachers` : undefined} />
        <KPICard label="Coaching Teachers" value={sn?.coaching_teachers ?? null} target={targetMap.coaching_post_call1} sub="using coaching feature" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="LP Teachers"       value={sn?.lp_teachers      ?? null} sub={sn ? `${sn.lp_requests} requests` : undefined} />
        <KPICard label="LP Completion"     value={sn?.lp_completion    ?? null} target={targetMap.lp_completion}  unit="%" />
        <KPICard label="Video Teachers"    value={sn?.video_teachers   ?? null} sub={sn ? `${sn.video_completion}% completion` : undefined} />
        <KPICard label="Community Members" value={sn?.community_members ?? null} />
      </div>

      {/* Timeline + Open Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-white font-semibold text-sm mb-5">Deployment Plan</h2>
          {milestonesData.length === 0
            ? <p className="text-gray-500 text-xs">No milestones seeded yet.</p>
            : <PlanTimeline milestones={milestonesData} />}
        </div>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold text-sm">Open Actions</h2>
            <Link href="/tracker/actions" className="text-xs text-indigo-400 hover:text-indigo-300">View all →</Link>
          </div>
          {actionsData.length === 0
            ? <p className="text-gray-500 text-xs">No open actions.</p>
            : <div className="space-y-3">
                {(actionsData as { id: string; text: string; owner: string; due_date: string; priority: string }[]).map(a => (
                  <div key={a.id} className="flex items-start gap-3">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${a.priority==='high'?'bg-red-400':a.priority==='medium'?'bg-amber-400':'bg-gray-500'}`} />
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
