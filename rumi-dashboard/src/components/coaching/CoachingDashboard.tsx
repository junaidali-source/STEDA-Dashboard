'use client'

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { HOTS_OBSERVATION_INDICATORS } from '@/lib/hots-rubric'

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
  first_score:         number | null
  latest_score:        number | null
  avg_g1:              number | null
  avg_g2:              number | null
  avg_g3:              number | null
  avg_g4:              number | null
  avg_g5:              number | null
  district?:    string
  designation?: string
  gender?:      string
}

// ── CSV export ─────────────────────────────────────────────────────────────────
function csvCell(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

function exportCSV(data: CoachUser[], isSteda: boolean, from: string, to: string) {
  const range = from && to ? `${from}_to_${to}` : from ? `from_${from}` : to ? `to_${to}` : 'all_time'
  const headers = ['#', 'Name', 'Phone', 'School',
    ...(isSteda ? ['District', 'Designation', 'Gender'] : ['Language']),
    'Sessions', 'Done', 'Rate %', 'Avg HOTS %', 'Trend (pp)',
    'HOTS 1 Assessment', 'HOTS 2 Cognitive', 'HOTS 3 Instruction', 'HOTS 4 Discourse', 'HOTS 5 Climate',
    'First Session', 'Last Session', 'Joined',
  ]
  const rows = data.map((u, i) => {
    const rate = u.total_sessions > 0 ? Math.round((u.completed_sessions / u.total_sessions) * 100) : 0
    const trend = (u.first_score != null && u.latest_score != null && u.completed_sessions >= 2)
      ? Math.round((u.latest_score - u.first_score) * 10) / 10 : ''
    return [
      i + 1, u.name, u.phone_number, u.school,
      ...(isSteda ? [u.district ?? '', u.designation ?? '', u.gender ?? ''] : [u.language]),
      u.total_sessions, u.completed_sessions, rate,
      u.avg_score ?? '', trend,
      u.avg_g1 ?? '', u.avg_g2 ?? '', u.avg_g3 ?? '', u.avg_g4 ?? '', u.avg_g5 ?? '',
      formatTableDate(u.first_session), formatTableDate(u.last_session), formatTableDate(u.joined),
    ]
  })
  const csv = [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv, ''], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `coaching_hots_${range}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function today()       { return new Date().toISOString().slice(0, 10) }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
function firstOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }

function formatTableDate(value: string | null): string {
  if (!value) return '—'
  const ymd = value.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd
  const t = Date.parse(value)
  return Number.isNaN(t) ? value : new Date(t).toISOString().slice(0, 10)
}

const PRESETS = [
  { label: 'All Time',   from: '',            to: '' },
  { label: 'Last 7d',    from: daysAgo(7),    to: today() },
  { label: 'Last 30d',   from: daysAgo(30),   to: today() },
  { label: 'This Month', from: firstOfMonth(), to: today() },
]

// ── Small components ───────────────────────────────────────────────────────────
function KPICard({ label, value, sub, accent, wrapClass }: {
  label: string; value: string | number; sub?: string; accent?: string; wrapClass?: string
}) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900/90 p-4 sm:p-5 ${wrapClass ?? ''}`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function RateBadge({ rate }: { rate: number }) {
  const cls = rate >= 80 ? 'text-green-400 bg-green-900/30' : rate >= 50 ? 'text-yellow-400 bg-yellow-900/30' : 'text-red-400 bg-red-900/30'
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${cls}`}>{rate}%</span>
}

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="h-9 w-9 border-[3px] border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
      <p className="text-xs text-gray-500">Loading coaching data…</p>
    </div>
  )
}

/** Explains the five HOTS rubric columns (replaces legacy G1–G5 in the UI). */
function HotsIndicatorsLegend() {
  return (
    <div className="rounded-2xl border border-teal-900/40 bg-gradient-to-br from-teal-950/50 via-gray-900/80 to-gray-950 p-4 sm:p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-400/95">
        HOTS observation breakdown
      </h3>
      <p className="text-xs text-gray-400 mt-2 max-w-3xl leading-relaxed">
        The five numeric columns in the table are <span className="text-gray-300">HOTS rubric indicators</span> (higher-order
        thinking in classroom observations). They replace the old OECD-style “G1–G5” goal labels in this dashboard.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {HOTS_OBSERVATION_INDICATORS.map((ind) => (
          <li key={ind.dataKey} className="rounded-xl border border-gray-800/90 bg-gray-950/60 p-3 sm:p-3.5">
            <div className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-600/20 text-[11px] font-bold text-teal-300 tabular-nums" aria-hidden>
                {ind.dimension}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-100 leading-snug">{ind.label}</p>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{ind.description}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 mb-2">
      {children}
    </h2>
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData('', '', '') }, [])

  function applyPreset(p: typeof PRESETS[0]) {
    setPreset(p.label); setFrom(p.from); setTo(p.to)
    fetchData(p.from, p.to, partner)
  }
  function applyCustom() { setPreset('Custom'); fetchData(from, to, partner) }
  function applyPartner(p: string) { setPartner(p); fetchData(from, to, p) }

  const filtered = (users ?? []).filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.name?.toLowerCase().includes(q) ||
           u.school?.toLowerCase().includes(q) ||
           u.phone_number?.includes(search) ||
           u.district?.toLowerCase().includes(q) ||
           u.designation?.toLowerCase().includes(q)
  })

  if (error) return (
    <div className="rounded-2xl bg-red-950/80 border border-red-800/80 p-6 text-red-200 text-sm">
      <strong className="text-red-100">Could not load coaching data.</strong>{' '}
      <span className="text-red-300/90">{error}</span>
    </div>
  )

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-500/90">Rumi Analytics</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Coaching &amp; HOTS observations</h1>
        <p className="text-sm text-gray-400 max-w-3xl leading-relaxed">
          {isSteda
            ? 'STEDA cohort: session activity and HOTS-scored classroom observations.'
            : 'All partners: session activity and HOTS-scored classroom observations.'}{' '}
          Scores use the{' '}
          <span className="text-gray-200">Higher Order Thinking Skills (HOTS)</span> framework; the previous OECD-based
          rubric is not shown here.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4 sm:p-5 shadow-lg shadow-black/20">
        <SectionLabel>Filters</SectionLabel>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <span className="text-xs text-gray-500 shrink-0">Range</span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button key={p.label} type="button" onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  preset === p.label ? 'bg-teal-600 text-white shadow-sm' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-l border-gray-700 pl-3 sm:pl-4 ml-0 sm:ml-1">
            <input type="date" value={from} title="From"
              onChange={e => { setFrom(e.target.value); setPreset('Custom') }}
              className="bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40" />
            <span className="text-gray-500 text-xs">→</span>
            <input type="date" value={to} title="To"
              onChange={e => { setTo(e.target.value); setPreset('Custom') }}
              className="bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40" />
            <button type="button" onClick={applyCustom}
              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-600 text-white text-xs rounded-lg font-medium transition-colors">
              Apply range
            </button>
          </div>
          {!isSteda && partners.length > 0 && (
            <select value={partner} onChange={e => applyPartner(e.target.value)} title="Filter by partner"
              className="sm:ml-auto bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-teal-500 min-w-[180px]">
              <option value="">All partners</option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.teacher_count} teachers)</option>
              ))}
            </select>
          )}
        </div>
      </section>

      {loading && !loadedRef.current ? <Spinner /> : summary && (
        <>
          <section>
            <SectionLabel>Session activity</SectionLabel>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
              <KPICard label="Users with sessions"  value={summary.usersWithSessions} />
              <KPICard label="Total sessions"        value={summary.totalSessions} />
              <KPICard label="Completed"             value={summary.completedSessions} accent="text-green-400" />
              <KPICard label="Completion rate"       value={`${summary.completionRate}%`}
                accent={summary.completionRate >= 80 ? 'text-green-400' : summary.completionRate >= 50 ? 'text-yellow-400' : 'text-red-400'} />
              <KPICard label="Active this month"     value={summary.activeThisMonth} sub="unique users" />
              <KPICard label="Sessions this month"   value={summary.sessionsThisMonth} />
            </div>
          </section>

          {summary.avgScore !== null && (
            <section>
              <SectionLabel>HOTS score summary</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <KPICard label="Avg HOTS score" value={`${summary.avgScore}%`}
                  sub="Across completed observations"
                  accent={summary.avgScore >= 80 ? 'text-green-400' : summary.avgScore >= 60 ? 'text-yellow-400' : 'text-red-400'}
                  wrapClass="border-teal-900/35 bg-teal-950/20" />
                <KPICard label="Highest session"  value={`${summary.topScore}%`} accent="text-green-400" sub="Best HOTS session in range" />
                <KPICard label="Lowest session" value={`${summary.lowScore}%`}
                  accent={(summary.lowScore ?? 0) >= 60 ? 'text-yellow-400' : 'text-red-400'} sub="Lowest HOTS session in range" />
              </div>
            </section>
          )}

          <HotsIndicatorsLegend />

          <section className="rounded-2xl border border-gray-800 bg-gray-900/40 overflow-hidden shadow-lg shadow-black/25">
            <div className="p-4 sm:p-5 border-b border-gray-800 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <SectionLabel>Per-user breakdown</SectionLabel>
                <h3 className="text-base font-semibold text-white mt-1">Observation results &amp; HOTS indicators</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {filtered.length} user{filtered.length !== 1 ? 's' : ''} · Teal columns are HOTS rubric averages (not G1–G5)
                  {loading && loadedRef.current ? ' · updating…' : ''}
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <input type="search" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={isSteda ? 'Search name, school, district…' : 'Search name, school, phone…'}
                  className="w-full sm:w-64 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30" />
                <button
                  type="button"
                  onClick={() => exportCSV(filtered, isSteda, from, to)}
                  disabled={filtered.length === 0}
                  title="Export current view as CSV"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-teal-800/70 hover:bg-teal-700 text-teal-100 border border-teal-700/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v8m0 0-3-3m3 3 3-3M3 12h10" />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 px-4 sm:px-5 py-2 border-b border-gray-800 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0" aria-hidden />
              <span>Scroll vertically for long lists; scroll horizontally if columns are clipped.</span>
            </p>

            <div className="relative">
              {loading && loadedRef.current && (
                <div className="absolute inset-0 z-20 bg-gray-950/25 pointer-events-none flex justify-center pt-8">
                  <span className="text-xs font-medium text-teal-300 bg-gray-900/95 border border-teal-800/50 px-3 py-1.5 rounded-full shadow-lg">
                    Refreshing…
                  </span>
                </div>
              )}
              <div className="overflow-auto max-h-[min(70vh,860px)]">
                <table className="min-w-[1024px] w-full text-[13px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-gray-800 bg-gray-900 text-left text-gray-400">
                      <th className="sticky left-0 z-20 bg-gray-900 px-3 py-3.5 font-medium text-gray-500 w-10">#</th>
                      <th className="px-3 py-3.5 font-medium">Name</th>
                      <th className="px-3 py-3.5 font-medium whitespace-nowrap">Phone</th>
                      <th className="px-3 py-3.5 font-medium min-w-[120px]">School</th>
                      {isSteda ? (
                        <>
                          <th className="px-3 py-3.5 font-medium">District</th>
                          <th className="px-3 py-3.5 font-medium">Designation</th>
                          <th className="px-3 py-3.5 font-medium">Gender</th>
                        </>
                      ) : (
                        <th className="px-3 py-3.5 font-medium">Language</th>
                      )}
                      <th className="text-right px-3 py-3.5 font-medium whitespace-nowrap">Sessions</th>
                      <th className="text-right px-3 py-3.5 font-medium">Done</th>
                      <th className="text-right px-3 py-3.5 font-medium">Rate</th>
                      <th className="text-right px-3 py-3.5 font-medium bg-indigo-950/40 border-l border-indigo-800/50 whitespace-nowrap" title="Average HOTS observation score">Avg HOTS</th>
                      <th className="text-right px-3 py-3.5 font-medium bg-indigo-950/40 whitespace-nowrap" title="First vs latest completed session">Trend</th>
                      {HOTS_OBSERVATION_INDICATORS.map((ind) => (
                        <th key={ind.dataKey} scope="col" title={ind.description}
                          className="text-right align-bottom px-2 py-3 font-medium border-l border-teal-800/35 bg-teal-950/25 min-w-[6.5rem] max-w-[7.5rem]">
                          <span className="flex flex-col items-end gap-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-teal-400/90 tabular-nums">HOTS {ind.dimension}</span>
                            <span className="text-[11px] leading-tight text-gray-100 font-semibold">{ind.label}</span>
                          </span>
                        </th>
                      ))}
                      <th className="px-3 py-3.5 font-medium whitespace-nowrap">First</th>
                      <th className="px-3 py-3.5 font-medium whitespace-nowrap">Last</th>
                      <th className="px-3 py-3.5 font-medium whitespace-nowrap">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={isSteda ? 20 : 18} className="text-center py-16 text-gray-500">
                          {loading ? 'Loading…' : 'No coaching sessions for this filter.'}
                        </td>
                      </tr>
                    ) : filtered.map((u, i) => {
                      const rate = u.total_sessions > 0
                        ? Math.round((u.completed_sessions / u.total_sessions) * 100) : 0
                      return (
                        <tr key={u.id} className="border-b border-gray-800/70 hover:bg-gray-800/35 transition-colors">
                          <td className="sticky left-0 z-[1] bg-gray-950/95 px-3 py-3 text-gray-500 tabular-nums border-r border-gray-800/80">{i + 1}</td>
                          <td className="px-3 py-3 text-white font-medium whitespace-nowrap">{u.name}</td>
                          <td className="px-3 py-3 text-gray-400 font-mono text-[12px]">{u.phone_number}</td>
                          <td className="px-3 py-3 text-gray-300 max-w-[200px] truncate" title={u.school}>{u.school}</td>
                          {isSteda ? (
                            <>
                              <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{u.district}</td>
                              <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{u.designation}</td>
                              <td className="px-3 py-3 text-gray-300">{u.gender}</td>
                            </>
                          ) : (
                            <td className="px-3 py-3 text-gray-300">{u.language}</td>
                          )}
                          <td className="px-3 py-3 text-right text-gray-200 font-medium tabular-nums">{u.total_sessions}</td>
                          <td className="px-3 py-3 text-right text-green-400/95 font-medium tabular-nums">{u.completed_sessions}</td>
                          <td className="px-3 py-3 text-right"><RateBadge rate={rate} /></td>
                          <td className="px-3 py-3 text-right border-l border-indigo-900/40 bg-indigo-950/15">
                            {u.avg_score !== null
                              ? <RateBadge rate={u.avg_score} />
                              : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="px-3 py-3 text-right bg-indigo-950/15">
                            {(() => {
                              if (u.first_score == null || u.latest_score == null || u.completed_sessions < 2) return <span className="text-gray-600">—</span>
                              const delta = Math.round((u.latest_score - u.first_score) * 10) / 10
                              if (delta === 0) return <span className="text-gray-400">±0</span>
                              return (
                                <span className={`inline-flex items-center justify-end gap-0.5 font-medium text-xs tabular-nums ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}pp
                                </span>
                              )
                            })()}
                          </td>
                          {HOTS_OBSERVATION_INDICATORS.map((ind) => (
                            <td key={ind.dataKey} className="px-2 py-3 text-right text-gray-300 tabular-nums border-l border-teal-900/25 bg-teal-950/10" title={`${ind.label}: ${ind.description}`}>
                              {u[ind.dataKey] ?? '—'}
                            </td>
                          ))}
                          <td className="px-3 py-3 text-gray-400 whitespace-nowrap tabular-nums text-[12px]">{formatTableDate(u.first_session)}</td>
                          <td className="px-3 py-3 text-gray-400 whitespace-nowrap tabular-nums text-[12px]">{formatTableDate(u.last_session)}</td>
                          <td className="px-3 py-3 text-gray-500 whitespace-nowrap tabular-nums text-[12px]">{formatTableDate(u.joined)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {filtered.length > 0 && (
              <div className="px-4 sm:px-5 py-3 border-t border-gray-800 text-[11px] text-gray-500 flex flex-col sm:flex-row sm:flex-wrap sm:justify-between gap-2">
                <span>
                  {filtered.length} users · {filtered.reduce((s, u) => s + u.completed_sessions, 0)} completed sessions
                </span>
                <span className="text-gray-600 leading-relaxed">
                  HOTS columns: {HOTS_OBSERVATION_INDICATORS.map((x) => `${x.label} (${x.dimension})`).join(' · ')}.
                </span>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
