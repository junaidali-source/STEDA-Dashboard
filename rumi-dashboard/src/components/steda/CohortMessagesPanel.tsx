'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface TimelineRow { date: string; count: number }
interface DesigRow {
  designation: string; grade_level: string
  total: number; positive: number; question: number; issue: number; other: number
}
interface SenderRow {
  sender: string; designation: string; grade_level: string
  total: number; positive: number; question: number; issue: number; other: number
  dominant_sentiment: string
}
interface HourRow { bucket: string; label: string; count: number }
interface Totals { total: number; positive: number; question: number; issue: number; other: number }

interface MessagesData {
  timeline: TimelineRow[]
  byDesignation: DesigRow[]
  topSenders: SenderRow[]
  hourlyActivity: HourRow[]
  totals: Totals
}

const SENT_COLOR: Record<string, string> = {
  positive: '#22C55E',
  question:  '#3B82F6',
  issue:     '#EF4444',
  other:     '#64748B',
}

const SENT_LABEL: Record<string, string> = {
  positive: 'Positive',
  question:  'Question',
  issue:     'Issue',
  other:     'Other',
}

function SentimentDot({ sentiment }: { sentiment: string }) {
  const color = SENT_COLOR[sentiment] ?? '#64748B'
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
}

function PctBar({ val, color }: { val: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-10 bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(val, 100)}%`, background: color }} />
      </div>
      <span className="text-gray-400 text-xs w-8">{val}%</span>
    </div>
  )
}

function pct(num: number, den: number) {
  return den ? Math.round((num / den) * 100) : 0
}

export default function CohortMessagesPanel({ queryStr }: { queryStr: string }) {
  const [data, setData] = useState<MessagesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/steda/cohorts/messages${queryStr}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [queryStr])

  if (loading) return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">💬</span>
        <h2 className="text-sm font-semibold text-blue-400">Community Message Analysis</h2>
      </div>
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )

  if (error) return (
    <div className="bg-gray-900 rounded-xl border border-red-800 p-5 text-red-400 text-sm">
      Message analysis error: {error}
    </div>
  )

  if (!data) return null

  const { timeline, byDesignation, topSenders, hourlyActivity, totals } = data
  const chartData = timeline.map(r => ({ ...r, label: r.date.slice(5) }))
  const maxHour = Math.max(...hourlyActivity.map(h => h.count), 1)

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">💬</span>
          <div>
            <h2 className="text-sm font-bold text-blue-400">Community Message Analysis</h2>
            <p className="text-xs text-gray-500 mt-0.5">WhatsApp activity from Cohort-1 and main Rumi group — patterns by designation and grade</p>
          </div>
        </div>
        {/* Totals row */}
        <div className="flex gap-4 text-xs">
          {(['positive', 'question', 'issue', 'other'] as const).map(k => (
            <span key={k} className="flex items-center gap-1">
              <SentimentDot sentiment={k} />
              <span className="text-gray-400">{SENT_LABEL[k]}:</span>
              <span className="text-gray-200 font-medium">{totals[k]}</span>
              <span className="text-gray-600">({pct(totals[k], totals.total)}%)</span>
            </span>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-6">

        {/* Row A: Activity Timeline */}
        {chartData.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Daily Message Activity ({totals.total} total)
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
                <defs>
                  <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 9 }} axisLine={false} tickLine={false}
                  angle={-40} textAnchor="end" interval={Math.max(0, Math.floor(chartData.length / 20))} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#F1F5F9', fontWeight: 600 }}
                  itemStyle={{ color: '#CBD5E1' }}
                />
                <Area type="monotone" dataKey="count" name="Messages" stroke="#3B82F6" fill="url(#msgGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Row B+C: Sentiment by Grade + When Active */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* B: Sentiment by Designation/Grade */}
          <div className="lg:col-span-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Patterns by Designation &amp; Grade Level
            </h3>
            {byDesignation.length === 0 ? (
              <p className="text-sm text-gray-500">No matched teacher messages in this range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="text-left py-2 pr-3 font-medium">Designation</th>
                      <th className="text-left py-2 pr-3 font-medium">Grade Level</th>
                      <th className="text-right py-2 pr-3 font-medium">Messages</th>
                      <th className="text-left py-2 pr-3 font-medium">Positive</th>
                      <th className="text-left py-2 pr-3 font-medium">Questions</th>
                      <th className="text-left py-2 font-medium">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDesignation.map(row => (
                      <tr key={row.designation} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-2 pr-3 font-medium text-gray-200">{row.designation}</td>
                        <td className="py-2 pr-3 text-gray-400">{row.grade_level}</td>
                        <td className="py-2 pr-3 text-right">
                          <span className="text-blue-400 font-semibold">{row.total}</span>
                        </td>
                        <td className="py-2 pr-3">
                          <PctBar val={pct(row.positive, row.total)} color={SENT_COLOR.positive} />
                        </td>
                        <td className="py-2 pr-3">
                          <PctBar val={pct(row.question, row.total)} color={SENT_COLOR.question} />
                        </td>
                        <td className="py-2">
                          <PctBar val={pct(row.issue, row.total)} color={SENT_COLOR.issue} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* C: When active */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              When They&apos;re Active (PKT)
            </h3>
            <div className="space-y-2">
              {hourlyActivity.map(h => (
                <div key={h.bucket} className="flex items-center gap-2">
                  <div className="w-32 text-xs text-gray-400 truncate">{h.label}</div>
                  <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-blue-500/70"
                      style={{ width: `${(h.count / maxHour) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-300 w-8 text-right">{h.count}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">Times in Pakistan Standard Time (UTC+5)</p>
          </div>
        </div>

        {/* Row D: Most Active Members */}
        {topSenders.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Most Active Members
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="text-left py-2 pr-3 font-medium">Name</th>
                    <th className="text-left py-2 pr-3 font-medium">Designation</th>
                    <th className="text-left py-2 pr-3 font-medium">Grade Level</th>
                    <th className="text-right py-2 pr-3 font-medium">Messages</th>
                    <th className="text-left py-2 pr-3 font-medium">Positive</th>
                    <th className="text-left py-2 pr-3 font-medium">Questions</th>
                    <th className="text-left py-2 pr-3 font-medium">Issues</th>
                    <th className="text-center py-2 font-medium">Tone</th>
                  </tr>
                </thead>
                <tbody>
                  {topSenders.map((s, i) => (
                    <tr key={s.sender} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          {i < 3 && <span className="text-amber-400">{['🥇','🥈','🥉'][i]}</span>}
                          <span className="font-medium text-gray-200 truncate max-w-[100px]">{s.sender}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-gray-400">{s.designation !== 'Unknown' ? s.designation : '—'}</td>
                      <td className="py-2 pr-3 text-gray-400">{s.grade_level !== 'Unspecified' ? s.grade_level : '—'}</td>
                      <td className="py-2 pr-3 text-right">
                        <span className="text-blue-400 font-semibold">{s.total}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <PctBar val={pct(s.positive, s.total)} color={SENT_COLOR.positive} />
                      </td>
                      <td className="py-2 pr-3">
                        <PctBar val={pct(s.question, s.total)} color={SENT_COLOR.question} />
                      </td>
                      <td className="py-2 pr-3">
                        <PctBar val={pct(s.issue, s.total)} color={SENT_COLOR.issue} />
                      </td>
                      <td className="py-2 text-center">
                        <span className="flex items-center justify-center gap-1">
                          <SentimentDot sentiment={s.dominant_sentiment} />
                          <span className="text-gray-500 capitalize">{SENT_LABEL[s.dominant_sentiment] ?? s.dominant_sentiment}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
