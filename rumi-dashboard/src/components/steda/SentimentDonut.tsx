'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

interface Segment       { name: string; value: number; color: string }
interface Quote         { speaker: string; text: string }
interface RecentMessage { sender: string; text: string; sentiment: string; date: string }
interface DailyActivity { date: string; count: number }

interface Props {
  totalMessages:  number
  segments:       Segment[]
  praiseQuotes:   Quote[]
  issueQuotes:    Quote[]
  totalCommunity?: number
  lastUpdated?:   string
  liveConnected?: boolean
  recentMessages?: RecentMessage[]
  dailyActivity?:  DailyActivity[]
  onRefresh?:     () => Promise<void>
}

type WaStatus = 'offline' | 'waiting_for_qr' | 'authenticated' | 'connected'

interface WaConfig {
  status: WaStatus
  qr_code: string | null
  groups: string[]
  updated_at?: string
}

// ── WhatsApp Activation Modal ────────────────────────────────────────────────
function WaActivateModal({ onClose }: { onClose: () => void }) {
  const [config, setConfig]           = useState<WaConfig>({ status: 'offline', qr_code: null, groups: [] })
  const [step, setStep]               = useState<1 | 2 | 3>(1)
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const intervalRef                   = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    try {
      const d: WaConfig = await fetch('/api/wa/config').then(r => r.json())
      setConfig(d)
    } catch {}
  }, [])

  useEffect(() => {
    // Auto-start the service (no-op on Vercel)
    fetch('/api/wa/launch', { method: 'POST' }).catch(() => {})
    poll()
    intervalRef.current = setInterval(poll, 3000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [poll])

  // Advance from step 1 → 2 once connected and groups are available
  useEffect(() => {
    if (step === 1 && config.status === 'connected' && config.groups.length > 0) {
      // Pre-select groups that look like Rumi/STEDA groups
      const auto = new Set(
        config.groups.filter(g =>
          ['rumi', 'onboarding', 'cohort', 'torch bearer', 'steda', 'feedback'].some(k =>
            g.toLowerCase().includes(k)
          )
        )
      )
      setSelected(auto)
      setStep(2)
    }
  }, [config, step])

  const toggleGroup = (g: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(g) ? next.delete(g) : next.add(g)
      return next
    })

  const STEPS = [
    { n: 1, label: 'Scan QR'        },
    { n: 2, label: 'Select Groups'  },
    { n: 3, label: 'Confirm'        },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">📱</span>
            <div>
              <h3 className="text-sm font-bold text-white">Connect WhatsApp Live</h3>
              <p className="text-xs text-gray-500 mt-0.5">Stream group messages to the dashboard in real-time</p>
            </div>
          </div>
          <button type="button" title="Close" onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {STEPS.map(({ n, label }, i, arr) => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step > n  ? 'bg-teal-500 text-white'   :
                  step === n ? 'bg-indigo-500 text-white' :
                  'bg-gray-800 text-gray-500'
                }`}>
                  {step > n ? '✓' : n}
                </div>
                <span className={`text-xs ${step >= n ? 'text-gray-200' : 'text-gray-600'}`}>{label}</span>
                {i < arr.length - 1 && (
                  <div className={`flex-1 h-px ${step > n ? 'bg-teal-500' : 'bg-gray-800'}`} />
                )}
              </div>
            ))}
          </div>

          {/* ── Step 1: Scan QR ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              {config.status === 'authenticated' ? (
                <div className="flex items-center gap-3 text-sm text-teal-400 bg-teal-900/20 border border-teal-800/30 rounded-lg px-4 py-3">
                  <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>QR scanned — loading your groups…</span>
                </div>
              ) : config.qr_code ? (
                <>
                  <p className="text-sm text-gray-300 font-medium">Scan with WhatsApp on your phone:</p>
                  <div className="flex gap-5 items-center">
                    <img
                      src={config.qr_code}
                      alt="WhatsApp QR Code"
                      className="w-48 h-48 rounded-xl border border-gray-700 bg-white p-2 shrink-0"
                    />
                    <ol className="text-xs text-gray-400 space-y-3 list-decimal list-inside">
                      <li>Open <span className="text-white font-medium">WhatsApp</span> on your phone</li>
                      <li>Tap <span className="text-white font-medium">⋮ → Linked Devices</span></li>
                      <li>Tap <span className="text-white font-medium">Link a Device</span></li>
                      <li>Point camera at the QR code</li>
                    </ol>
                  </div>
                  <p className="text-xs text-gray-600">QR refreshes automatically. Keep this window open.</p>
                </>
              ) : (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <div className="text-center">
                    <p className="text-sm text-gray-200 font-medium">Starting WhatsApp…</p>
                    <p className="text-xs text-gray-500 mt-1">Generating QR code, this takes a few seconds</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Select Groups ────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-300 font-medium">
                Select the groups to monitor
                <span className="text-xs text-gray-500 font-normal ml-2">({config.groups.length} available)</span>
              </p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {config.groups.map(g => {
                  const checked = selected.has(g)
                  const isSuggested = ['rumi', 'onboarding', 'cohort', 'torch bearer', 'steda', 'feedback'].some(k =>
                    g.toLowerCase().includes(k)
                  )
                  return (
                    <label key={g}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        checked ? 'bg-indigo-900/40 border border-indigo-700/50' : 'bg-gray-800/60 border border-transparent hover:bg-gray-800'
                      }`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGroup(g)}
                        className="w-4 h-4 rounded accent-indigo-500 shrink-0"
                      />
                      <span className={`text-xs flex-1 ${checked ? 'text-gray-100' : 'text-gray-400'}`}>{g}</span>
                      {isSuggested && (
                        <span className="text-xs text-indigo-400 bg-indigo-900/40 px-1.5 py-0.5 rounded font-medium">suggested</span>
                      )}
                    </label>
                  )
                })}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-gray-500">{selected.size} group{selected.size !== 1 ? 's' : ''} selected</span>
                <button
                  type="button"
                  disabled={selected.size === 0}
                  onClick={() => setStep(3)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-lg font-semibold transition-colors">
                  Confirm →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Confirm ──────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-teal-400 bg-teal-900/20 border border-teal-800/30 rounded-lg px-4 py-3">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shrink-0" />
                <span>Live stream connected — messages flowing in real-time</span>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
                  Monitoring {selected.size} group{selected.size !== 1 ? 's' : ''}
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {Array.from(selected).map(g => (
                    <div key={g} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-teal-900/30 border border-teal-800/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                      <span className="text-gray-200">{g}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" onClick={onClose}
                className="w-full py-2 bg-teal-700 hover:bg-teal-600 text-white text-sm rounded-lg font-semibold transition-colors">
                Done
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#22C55E',
  question: '#3B82F6',
  issue:    '#EF4444',
  other:    '#64748B',
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (days  > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins  > 0) return `${mins}m ago`
  return 'just now'
}

export default function SentimentDonut({
  totalMessages, segments, praiseQuotes, issueQuotes,
  totalCommunity, lastUpdated, liveConnected, recentMessages, dailyActivity, onRefresh,
}: Props) {
  const [refreshing, setRefreshing] = useState(false)
  const [showActivate, setShowActivate] = useState(false)
  const relativeTime = lastUpdated ? formatRelativeTime(lastUpdated) : null

  async function handleRefresh() {
    if (!onRefresh || refreshing) return
    setRefreshing(true)
    try { await onRefresh() } finally { setRefreshing(false) }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-5">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">WhatsApp Community Sentiment</h3>
          {totalCommunity ? (
            <p className="text-xs text-gray-500 mt-0.5">{totalCommunity.toLocaleString()} members in community</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded-full transition-colors disabled:opacity-50"
              title="Refresh sentiment data"
            >
              <svg
                className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
          {/* Live service connection badge — clickable to open activation modal */}
          {liveConnected ? (
            <button type="button" onClick={() => setShowActivate(true)}
              className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/40 px-2 py-1 rounded-full hover:bg-green-900/60 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live stream · connected
            </button>
          ) : (
            <button type="button" onClick={() => setShowActivate(true)}
              className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-900/30 px-2 py-1 rounded-full hover:bg-amber-900/50 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              File mode · activate live
            </button>
          )}
          {showActivate && <WaActivateModal onClose={() => setShowActivate(false)} />}
          {relativeTime && (
            <span className="text-xs text-teal-400 bg-teal-900/40 px-2 py-1 rounded-full">
              updated {relativeTime}
            </span>
          )}
          {lastUpdated && (
            <p className="text-xs text-gray-600">
              {new Date(lastUpdated).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
            </p>
          )}
        </div>
      </div>

      {/* Donut + legend row */}
      <div className="flex gap-6 items-start">
        <div className="relative shrink-0" style={{ width: 180, height: 180 }}>
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie
                data={segments}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={82}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                {segments.map((s, i) => (
                  <Cell key={i} fill={s.color} stroke="#0F172A" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                itemStyle={{ color: '#CBD5E1' }}
                formatter={(v: number | undefined) => [`${v ?? 0} msgs`]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-white">{totalMessages}</span>
            <span className="text-xs text-gray-400">messages</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          {segments.map(s => (
            <div key={s.name} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-gray-300">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                {s.name}
              </span>
              <span className="text-sm font-semibold text-white">
                {s.value}{' '}
                <span className="text-gray-500 font-normal text-xs">
                  ({totalMessages > 0 ? Math.round(s.value / totalMessages * 100) : 0}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Daily activity sparkline */}
      {dailyActivity && dailyActivity.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Message activity by day</p>
          <ResponsiveContainer width="100%" height={70}>
            <BarChart data={dailyActivity} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis
                dataKey="date"
                tick={false}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
              />
              <YAxis tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#F1F5F9' }}
                itemStyle={{ color: '#22C55E' }}
                formatter={(v: number | undefined) => [`${v ?? 0} messages`]}
              />
              <Bar dataKey="count" fill="#0D9488" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Teacher voice quotes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {praiseQuotes.slice(0, 2).map((q, i) => (
          <blockquote key={i} className="border-l-2 border-teal-500 pl-3 py-1.5 bg-gray-800 rounded-r text-xs text-gray-300 italic">
            &ldquo;{q.text}&rdquo;
            <footer className="text-gray-500 mt-1 not-italic">— {q.speaker}</footer>
          </blockquote>
        ))}
        {issueQuotes.slice(0, 2).map((q, i) => (
          <blockquote key={i} className="border-l-2 border-red-500 pl-3 py-1.5 bg-gray-800 rounded-r text-xs text-gray-300 italic">
            &ldquo;{q.text}&rdquo;
            <footer className="text-gray-500 mt-1 not-italic">— {q.speaker}</footer>
          </blockquote>
        ))}
      </div>

      {/* Live message feed */}
      {recentMessages && recentMessages.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Recent community messages</p>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {recentMessages.map((m, i) => {
              const color = SENTIMENT_COLORS[m.sentiment] ?? '#64748B'
              return (
                <div key={i} className="flex gap-2 items-start">
                  <span
                    className="mt-1 w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                    title={m.sentiment}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-300">{m.sender}</span>
                    <span className="text-xs text-gray-600 ml-1">{m.date}</span>
                    <p className="text-xs text-gray-400 truncate">{m.text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
