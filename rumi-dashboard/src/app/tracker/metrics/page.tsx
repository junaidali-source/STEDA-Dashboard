export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import MetricChart from '@/components/tracker/MetricChart'
import SnapshotModal from '@/components/tracker/SnapshotModal'

export default async function MetricsPage() {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  const { data: snapshots } = await supabase
    .from('metric_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: true })
    .limit(52)

  const rows = snapshots ?? []

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Metric Snapshots</h1>
          <p className="text-sm text-gray-500 mt-1">Track deployment progress over time</p>
        </div>
        <SnapshotModal />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <p className="text-xs text-gray-400 font-medium mb-4">KPI Trends</p>
        <MetricChart snapshots={rows} />
      </div>

      {rows.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                {['Date','Listed','Joined','Joined %','Used Any %','LP Teachers','Coaching','Source'].map(h => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rows as Array<{ snapshot_date: string; teachers_listed: number; teachers_joined: number; joined_pct: number; used_any_pct: number; lp_teachers: number; coaching_teachers: number; source: string }>).map((s, i) => (
                <tr key={i} className={`border-b border-gray-800/50 ${i%2===1 ? 'bg-gray-900/30':''}`}>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{s.snapshot_date}</td>
                  <td className="px-4 py-3 text-gray-400">{s.teachers_listed ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{s.teachers_joined ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{s.joined_pct ?? '—'}%</td>
                  <td className="px-4 py-3 text-gray-400">{s.used_any_pct ?? '—'}%</td>
                  <td className="px-4 py-3 text-gray-400">{s.lp_teachers ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{s.coaching_teachers ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
