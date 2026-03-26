'use client'

import { useState } from 'react'
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
          {/* Live service connection badge */}
          {liveConnected ? (
            <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/40 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live stream · connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-900/30 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              File mode · run whatsapp-service for live
            </span>
          )}
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
