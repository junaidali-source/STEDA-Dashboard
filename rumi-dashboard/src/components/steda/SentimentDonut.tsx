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
  const [config, setConfig] = useState<WaConfig>({ status: 'offline', qr_code: null, groups: [] })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    try {
      const d: WaConfig = await fetch('/api/wa/config').then(r => r.json())
      setConfig(d)
      if (d.status === 'connected') {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    } catch {}
  }, [])

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(poll, 3000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [poll])

  const step =
    config.status === 'connected'    ? 3 :
    config.status === 'authenticated' ? 2 :
    config.status === 'waiting_for_qr' && config.qr_code ? 2 : 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">📱</span>
            <div>
              <h3 className="text-sm font-bold text-white">Connect WhatsApp Live</h3>
              <p className="text-xs text-gray-500 mt-0.5">Enables real-time message streaming to the dashboard</p>
            </div>
          </div>
          <button type="button" title="Close" onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {[
              { n: 1, label: 'Start service' },
              { n: 2, label: 'Scan QR' },
              { n: 3, label: 'Connected' },
            ].map(({ n, label }, i, arr) => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step > n ? 'bg-teal-500 text-white' :
                  step === n ? 'bg-indigo-500 text-white' :
                  'bg-gray-800 text-gray-500'
                }`}>
                  {step > n ? '✓' : n}
                </div>
                <span className={`text-xs ${step >= n ? 'text-gray-200' : 'text-gray-600'}`}>{label}</span>
                {i < arr.length - 1 && <div className={`flex-1 h-px ${step > n ? 'bg-teal-500' : 'bg-gray-800'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Start service */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-300">Run the WhatsApp service on your local machine:</p>
              <div className="bg-gray-950 border border-gray-700 rounded-lg p-3 font-mono text-xs text-teal-400">
                <span className="text-gray-500">$</span> cd whatsapp-service<br />
                <span className="text-gray-500">$</span> npm start
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/30 rounded-lg px-3 py-2">
                <span>⏳</span>
                <span>Waiting for service to start… (checking every 3s)</span>
                <div className="ml-auto w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          )}

          {/* Step 2: QR code */}
          {step === 2 && (
            <div className="space-y-3">
              {config.status === 'authenticated' ? (
                <div className="flex items-center gap-2 text-sm text-teal-400 bg-teal-900/20 border border-teal-800/30 rounded-lg px-3 py-3">
                  <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                  <span>QR scanned — loading your groups…</span>
                </div>
              ) : config.qr_code ? (
                <>
                  <p className="text-sm text-gray-300">Scan with WhatsApp on your phone:</p>
                  <div className="flex gap-4 items-start">
                    <img
                      src={config.qr_code}
                      alt="WhatsApp QR Code"
                      className="w-40 h-40 rounded-lg border border-gray-700 bg-white p-1 shrink-0"
                    />
                    <ol className="text-xs text-gray-400 space-y-2 list-decimal list-inside pt-1">
                      <li>Open <span className="text-white">WhatsApp</span> on your phone</li>
                      <li>Tap <span className="text-white">⋮ → Linked Devices</span></li>
                      <li>Tap <span className="text-white">Link a Device</span></li>
                      <li>Point camera at this QR code</li>
                    </ol>
                  </div>
                  <p className="text-xs text-gray-600">QR code refreshes automatically. Keep this window open.</p>
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                  <span>Waiting for QR code from service…</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Connected */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-teal-400 bg-teal-900/20 border border-teal-800/30 rounded-lg px-3 py-3">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shrink-0" />
                <span>Live stream connected — messages flowing in real-time</span>
              </div>
              {config.groups.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Monitored Groups ({config.groups.length})</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {config.groups.map(g => {
                      const isMonitored = ['rumi onboarding', 'cohort', 'torch bearer'].some(k => g.toLowerCase().includes(k))
                      return (
                        <div key={g} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${isMonitored ? 'bg-teal-900/30 border border-teal-800/40' : 'bg-gray-800/50'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMonitored ? 'bg-teal-400' : 'bg-gray-600'}`} />
                          <span className={isMonitored ? 'text-gray-200' : 'text-gray-500'}>{g}</span>
                          {isMonitored && <span className="ml-auto text-teal-500 text-xs">monitored</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <button type="button" onClick={onClose} className="w-full py-2 bg-teal-700 hover:bg-teal-600 text-white text-sm rounded-lg font-medium transition-colors">
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
