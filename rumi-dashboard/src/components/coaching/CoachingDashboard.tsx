'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Partner { id: string; name: string; teacher_count: number }

interface Summary {
  usersWithSessions: number
  totalSessions:     number
  completedSessions: number
  completionRate:    number
  activeThisMonth:   number
  sessionsThisMonth: number
  avgScore:  number | null
  topScore:  number | null
  lowScore:  number | null
}

interface CoachUser {
  id:                  string
  name:                string
  phone_number:        string
  school:              string
  language:            string
  joined:              string
  total_sessions:      number
  completed_sessions:  number
  first_session:       string | null
  last_session:        string | null
  avg_score:           number | null
  avg_g1:              number | null
  avg_g2:              number | null
  avg_g3:              number | null
  avg_g4:              number | null
  avg_g5:              number | null
  // STEDA extras
  district?:    string
  designation?: string
  gender?:      string
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function today()       { return new Date().toISOString().slice(0, 10) }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
function firstOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }

const PRESETS = [
  { label: 'All Time',   from: '',            to: '' },
  { label: 'Last 7d',    from: daysAgo(7),    to: today() },
  { label: 'Last 30d',   from: daysAgo(30),   to: today() },
  { label: 'This Month', from: firstOfMonth(), to: today() },
]

// ── Small components ───────────────────────────────────────────────────────────
function KPICard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function RateBadge({ rate }: { rate: number }) {
  const cls = rate >= 80 ? 'text-green-400 bg-green-900/30' : rate >= 50 ? 'text-yellow-400 bg-yellow-900/30' : 'text-red-400 bg-red-900/30'
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{rate}%</span>
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CoachingDashboard({ role }: { role: string }) {
  const isSteda = role === 'steda'
  const scope   = isSteda ? 'steda' : ''

  const [from,    setFrom]    = useState('')
  const [to,      setTo]      = useState('')
  const [preset,  setPreset]  = useState('All Time')
  const [partner, setPartner] = useState('')
  const [partners, setPartners] = useState<Partner[]>([])

  const [summary, setSummary] = useState<Summary | null>(null)
  const [users,   setUsers]   = useState<CoachUser[] | null>(null)
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const loadedRef = useRef(false)

  // Load partner list (admin only)
  useEffect(() => {
    if (isSteda) return
    fetch('/api/partners').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setPartners(d)
    }).catch(() => {})
  }, [isSteda])

  const fetchData = useCallback(async (f: string, t: string, p: string) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (f) qs.set('from', f)
      if (t) qs.set('to', t)
      if (scope) qs.set('scope', scope)
      if (p) qs.set('partner', p)
      const q = qs.toString() ? `?${qs}` : ''

      const [s, u] = await Promise.all([
        fetch(`/api/coaching/summary${q}`).then(r => r.json()),
        fetch(`/api/coaching/users${q}`).then(r => r.json()),
      ])
      if (s.error) throw new Error(s.error)
      setSummary(s)
      setUsers(Array.isArray(u) ? u : [])
      loadedRef.current = true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading coaching data')
    } finally {
      setLoading(false)
    }
  }, [scope])

  // Initial load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData('', '', '') }, [])

  function applyPreset(p: typeof PRESETS[0]) {
    setPreset(p.label); setFrom(p.from); setTo(p.to)
    fetchData(p.from, p.to, partner)
  }
  function applyCustom() { setPreset('Custom'); fetchData(from, to, partner) }
  function applyPartner(p: string) { setPartner(p); fetchData(from, to, p) }

  // Client-side search
  const filtered = (users ?? []).filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.name?.toLowerCase().includes(q) ||
           u.school?.toLowerCase().includes(q) ||
           u.phone_number?.includes(search) ||
           u.district?.toLowerCase().includes(q) ||
           u.designation?.toLowerCase().includes(q)
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="rounded-xl bg-red-950 border border-red-800 p-6 text-red-300 text-sm">
      <strong>Error loading coaching data:</strong> {error}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Coaching Sessions</h1>
        <p className="text-sm text-gray-400 mt-1">
          {isSteda
            ? 'Breakdown of coaching sessions for STEDA teachers'
            : 'Comprehensive coaching activity across all registered users'}
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs text-gray-400 font-medium shrink-0">Date range:</span>
        <div className="flex gap-1 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.label} type="button" onClick={() => applyPreset(p)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                preset === p.label ? 'bg-teal-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={from} title="From"
            onChange={e => { setFrom(e.target.value); setPreset('Custom') }}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-teal-500" />
          <span className="text-gray-500 text-xs">to</span>
          <input type="date" value={to} title="To"
            onChange={e => { setTo(e.target.value); setPreset('Custom') }}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-teal-500" />
          <button type="button" onClick={applyCustom}
            className="px-3 py-1 bg-teal-700 hover:bg-teal-600 text-white text-xs rounded font-medium transition-colors">
            Apply
          </button>
        </div>
        {/* Partner selector — admin only */}
        {!isSteda && partners.length > 0 && (
          <select value={partner} onChange={e => applyPartner(e.target.value)} title="Filter by partner"
            className="ml-auto bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-teal-500">
            <option value="">All Partners</option>
            {partners.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.teacher_count} teachers)</option>
            ))}
          </select>
        )}
      </div>

      {loading && !loadedRef.current ? <Spinner /> : summary && (
        <>
          {/* KPI Cards — activity */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <KPICard label="Users with Sessions"  value={summary.usersWithSessions} />
            <KPICard label="Total Sessions"        value={summary.totalSessions} />
            <KPICard label="Completed"             value={summary.completedSessions} accent="text-green-400" />
            <KPICard label="Completion Rate"       value={`${summary.completionRate}%`}
              accent={summary.completionRate >= 80 ? 'text-green-400' : summary.completionRate >= 50 ? 'text-yellow-400' : 'text-red-400'} />
            <KPICard label="Active This Month"     value={summary.activeThisMonth} sub="unique users" />
            <KPICard label="Sessions This Month"   value={summary.sessionsThisMonth} />
          </div>

          {/* KPI Cards — scores */}
          {summary.avgScore !== null && (
            <div className="grid grid-cols-3 gap-4">
              <KPICard label="Avg Coaching Score" value={`${summary.avgScore}%`}
                sub="across all completed sessions"
                accent={summary.avgScore >= 80 ? 'text-green-400' : summary.avgScore >= 60 ? 'text-yellow-400' : 'text-red-400'} />
              <KPICard label="Top Score"  value={`${summary.topScore}%`} accent="text-green-400" sub="highest session score" />
              <KPICard label="Lowest Score" value={`${summary.lowScore}%`}
                accent={(summary.lowScore ?? 0) >= 60 ? 'text-yellow-400' : 'text-red-400'} sub="lowest session score" />
            </div>
          )}

          {/* User table */}
          <div className="bg-gray-900 rounded-xl border border-gray-800">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  {isSteda ? 'STEDA Teacher Breakdown' : 'User Breakdown'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {filtered.length} user{filtered.length !== 1 ? 's' : ''} with coaching sessions
                  {loading && ' · refreshing…'}
                </p>
              </div>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder={isSteda ? 'Search by name, school, district…' : 'Search by name, school, phone…'}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-teal-500 w-72" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 bg-gray-800/50 border-b border-gray-800">
                    <th className="text-left px-4 py-3 font-medium">#</th>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Phone</th>
                    <th className="text-left px-4 py-3 font-medium">School</th>
                    {isSteda ? (
                      <>
                        <th className="text-left px-4 py-3 font-medium">District</th>
                        <th className="text-left px-4 py-3 font-medium">Designation</th>
                        <th className="text-left px-4 py-3 font-medium">Gender</th>
                      </>
                    ) : (
                      <th className="text-left px-4 py-3 font-medium">Language</th>
                    )}
                    <th className="text-right px-4 py-3 font-medium">Sessions</th>
                    <th className="text-right px-4 py-3 font-medium">Done</th>
                    <th className="text-right px-4 py-3 font-medium">Rate</th>
                    <th className="text-right px-4 py-3 font-medium bg-indigo-900/20 border-l border-gray-700">Avg Score</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500" title="Formative Assessment">G1</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500" title="Student Engagement">G2</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500" title="Quality Content">G3</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500" title="Classroom Interaction">G4</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500" title="Classroom Management">G5</th>
                    <th className="text-left px-4 py-3 font-medium">First Session</th>
                    <th className="text-left px-4 py-3 font-medium">Last Session</th>
                    <th className="text-left px-4 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={isSteda ? 16 : 14}
                        className="text-center py-16 text-gray-500">
                        {loading ? 'Loading…' : 'No coaching sessions found for this filter.'}
                      </td>
                    </tr>
                  ) : filtered.map((u, i) => {
                    const rate = u.total_sessions > 0
                      ? Math.round((u.completed_sessions / u.total_sessions) * 100) : 0
                    return (
                      <tr key={u.id}
                        className="border-b border-gray-800/60 hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                        <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{u.name}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono">{u.phone_number}</td>
                        <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate" title={u.school}>{u.school}</td>
                        {isSteda ? (
                          <>
                            <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{u.district}</td>
                            <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{u.designation}</td>
                            <td className="px-4 py-3 text-gray-300">{u.gender}</td>
                          </>
                        ) : (
                          <td className="px-4 py-3 text-gray-300">{u.language}</td>
                        )}
                        <td className="px-4 py-3 text-right text-gray-200 font-medium">{u.total_sessions}</td>
                        <td className="px-4 py-3 text-right text-green-400 font-medium">{u.completed_sessions}</td>
                        <td className="px-4 py-3 text-right"><RateBadge rate={rate} /></td>
                        <td className="px-4 py-3 text-right border-l border-gray-700 bg-indigo-900/10">
                          {u.avg_score !== null
                            ? <RateBadge rate={u.avg_score} />
                            : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">{u.avg_g1 ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{u.avg_g2 ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{u.avg_g3 ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{u.avg_g4 ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{u.avg_g5 ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{u.first_session ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{u.last_session ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{u.joined}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-500 flex flex-wrap justify-between gap-2">
                <span>{filtered.length} users shown · {filtered.reduce((s, u) => s + u.completed_sessions, 0)} completed sessions total</span>
                <span className="text-gray-600">
                  G1 Formative Assessment · G2 Student Engagement · G3 Quality Content · G4 Classroom Interaction · G5 Classroom Management
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
