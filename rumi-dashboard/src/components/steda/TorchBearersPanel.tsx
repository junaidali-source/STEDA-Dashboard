'use client'

import { useEffect, useState } from 'react'

interface UserRow {
  id: string
  name: string
  phone_number: string
  school: string
  district: string
  designation: string
  gender: string
  completed_sessions: number
  avg_score: number | null
  first_score: number | null
  latest_score: number | null
  improvement: number | null
  is_torch_bearer: boolean
  similarity_score?: number
}

interface Stats {
  total_torch_bearers_matched: number
  total_torch_bearers_expected: number
  avg_score: number
  avg_sessions: number
  avg_improvement: number
  top_districts: [string, number][]
  designation_breakdown: Record<string, number>
  gender_breakdown: Record<string, number>
  sessions_with_data: number
}

interface TorchData {
  torch: UserRow[]
  similar: UserRow[]
  stats: Stats
}

function ScoreBadge({ val, first, latest }: { val: number | null; first?: number | null; latest?: number | null }) {
  if (val == null) return <span className="text-gray-600 text-xs">—</span>
  const color = val >= 70 ? 'text-teal-400' : val >= 50 ? 'text-amber-400' : 'text-red-400'
  const trend = first != null && latest != null
    ? latest > first ? '↑' : latest < first ? '↓' : '→'
    : null
  const trendColor = trend === '↑' ? 'text-teal-400' : trend === '↓' ? 'text-red-400' : 'text-gray-500'
  return (
    <span className="flex items-center gap-1">
      <span className={`font-semibold text-sm ${color}`}>{val}%</span>
      {trend && <span className={`text-xs ${trendColor}`}>{trend}</span>}
    </span>
  )
}

function ImproveBadge({ val }: { val: number | null }) {
  if (val == null) return <span className="text-gray-600 text-xs">—</span>
  const color = val > 0 ? 'text-teal-400' : val < 0 ? 'text-red-400' : 'text-gray-400'
  return <span className={`text-xs font-medium ${color}`}>{val > 0 ? '+' : ''}{val}%</span>
}

function DistributionBar({ data }: { data: Record<string, number> | [string, number][] }) {
  const entries = Array.isArray(data) ? data : Object.entries(data)
  const total = entries.reduce((s, [, v]) => s + v, 0)
  if (!total) return null
  const colors = ['bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500']
  return (
    <div className="flex flex-col gap-1">
      {entries.map(([label, count], i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="w-24 text-xs text-gray-400 truncate">{label}</div>
          <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
            <div className={`h-2 rounded-full ${colors[i % colors.length]}`} style={{ width: `${(count / total) * 100}%` }} />
          </div>
          <div className="text-xs text-gray-300 w-6 text-right">{count}</div>
        </div>
      ))}
    </div>
  )
}

export default function TorchBearersPanel({ queryStr }: { queryStr: string }) {
  const [data, setData] = useState<TorchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'members' | 'similar'>('members')

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/steda/torch-bearers${queryStr}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [queryStr])

  if (loading) return (
    <div className="bg-gray-900 rounded-xl border border-amber-800/40 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🔥</span>
        <h2 className="text-sm font-semibold text-amber-400">Cohort 1 — The Torch Bearers</h2>
      </div>
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )

  if (error) return (
    <div className="bg-gray-900 rounded-xl border border-red-800 p-5 text-red-400 text-sm">
      Torch Bearers error: {error}
    </div>
  )

  if (!data) return null

  const { torch, similar, stats } = data

  return (
    <div className="bg-gray-900 rounded-xl border border-amber-800/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-amber-800/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔥</span>
          <div>
            <h2 className="text-sm font-bold text-amber-400">Cohort 1 — The Torch Bearers</h2>
            <p className="text-xs text-gray-500 mt-0.5">Highly engaged teachers selected for deeper coaching (April 2026)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('members')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === 'members' ? 'bg-amber-700/60 text-amber-300' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            Members ({torch.length})
          </button>
          <button onClick={() => setTab('similar')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === 'similar' ? 'bg-teal-700/60 text-teal-300' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            Similar Teachers
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-800/60 border-b border-gray-800">
        {[
          { label: 'Matched in DB', val: `${stats.sessions_with_data} / ${stats.total_torch_bearers_matched}`, sub: 'have sessions' },
          { label: 'Avg Score', val: stats.avg_score ? `${stats.avg_score}%` : '—', sub: 'across sessions' },
          { label: 'Avg Sessions', val: stats.avg_sessions ? `${stats.avg_sessions}` : '—', sub: 'completed' },
          { label: 'Avg Improvement', val: stats.avg_improvement ? `${stats.avg_improvement > 0 ? '+' : ''}${stats.avg_improvement}%` : '—', sub: 'first→latest' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 px-4 py-3 text-center">
            <div className="text-lg font-bold text-amber-400">{s.val}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className="text-xs text-gray-600">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main table */}
        <div className="lg:col-span-2">
          {tab === 'members' ? (
            <>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Member Coaching Progress</h3>
              {torch.length === 0 ? (
                <p className="text-sm text-gray-500">No matched Torch Bearers found in the database for this date range.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400">
                        <th className="text-left py-2 pr-3 font-medium">Name</th>
                        <th className="text-left py-2 pr-3 font-medium">District</th>
                        <th className="text-right py-2 pr-3 font-medium">Sessions</th>
                        <th className="text-right py-2 pr-3 font-medium">Avg Score</th>
                        <th className="text-right py-2 font-medium">Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {torch.map(t => (
                        <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="py-2 pr-3">
                            <div className="font-medium text-gray-200 truncate max-w-[120px]">{t.name || '—'}</div>
                            <div className="text-gray-600 truncate max-w-[120px]">{t.school}</div>
                          </td>
                          <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">{t.district}</td>
                          <td className="py-2 pr-3 text-right">
                            {t.completed_sessions > 0
                              ? <span className="text-teal-400 font-semibold">{t.completed_sessions}</span>
                              : <span className="text-gray-600">0</span>
                            }
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <ScoreBadge val={t.avg_score} first={t.first_score} latest={t.latest_score} />
                          </td>
                          <td className="py-2 text-right">
                            <ImproveBadge val={t.improvement} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                Teachers with Similar Profiles
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                STEDA teachers NOT in Cohort 1 who share similar district, designation, score range, and session count with the Torch Bearers — ranked by similarity.
              </p>
              {similar.length === 0 ? (
                <p className="text-sm text-gray-500">No similar teachers found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400">
                        <th className="text-left py-2 pr-3 font-medium">Name</th>
                        <th className="text-left py-2 pr-3 font-medium">District</th>
                        <th className="text-right py-2 pr-3 font-medium">Sessions</th>
                        <th className="text-right py-2 pr-3 font-medium">Avg Score</th>
                        <th className="text-right py-2 font-medium">Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {similar.map(t => (
                        <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="py-2 pr-3">
                            <div className="font-medium text-gray-200 truncate max-w-[120px]">{t.name || '—'}</div>
                            <div className="text-gray-600 truncate max-w-[120px]">{t.school}</div>
                          </td>
                          <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">{t.district}</td>
                          <td className="py-2 pr-3 text-right">
                            <span className="text-teal-400 font-semibold">{t.completed_sessions}</span>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <ScoreBadge val={t.avg_score} />
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className={`h-2 w-2 rounded-full ${
                                  i < (t.similarity_score ?? 0) ? 'bg-teal-500' : 'bg-gray-700'
                                }`} />
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Commonalities sidebar */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-2">Top Districts</h3>
            <DistributionBar data={stats.top_districts} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-2">Designation</h3>
            <DistributionBar data={stats.designation_breakdown} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-2">Gender</h3>
            <DistributionBar data={stats.gender_breakdown} />
          </div>
          <div className="bg-gray-800/40 rounded-lg p-3 border border-amber-800/20">
            <h3 className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-2">Cohort Profile</h3>
            <ul className="text-xs text-gray-400 space-y-1">
              {stats.top_districts[0] && (
                <li>📍 Mostly from <span className="text-gray-200">{stats.top_districts[0][0]}</span></li>
              )}
              {Object.entries(stats.designation_breakdown).sort((a,b)=>b[1]-a[1])[0] && (
                <li>🏷️ Mainly <span className="text-gray-200">{Object.entries(stats.designation_breakdown).sort((a,b)=>b[1]-a[1])[0][0]}</span></li>
              )}
              {stats.avg_score > 0 && (
                <li>📊 Avg score <span className="text-teal-400">{stats.avg_score}%</span></li>
              )}
              {stats.avg_sessions > 0 && (
                <li>🎙️ Avg <span className="text-teal-400">{stats.avg_sessions}</span> sessions</li>
              )}
              {stats.avg_improvement !== 0 && (
                <li>📈 Avg improvement <span className={stats.avg_improvement > 0 ? 'text-teal-400' : 'text-red-400'}>{stats.avg_improvement > 0 ? '+' : ''}{stats.avg_improvement}%</span></li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
