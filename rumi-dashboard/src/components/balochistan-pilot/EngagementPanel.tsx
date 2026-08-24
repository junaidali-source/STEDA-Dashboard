'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

interface EngagementWeek {
  week: string
  activeTeachers: number
  teachersWithLp: number
  lpWeeklyPct: number
  coachingAttempted: number
  coachingTeachers: number
}
interface CoachingScoreWeek { week: string; avgScore: number | null; scoredSessions: number }
interface EngagementData { engagement: EngagementWeek[]; coachingScores: CoachingScoreWeek[]; lpWeeklyTargetPct: number }

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h3 className="text-white font-semibold text-sm mb-1">{title}</h3>
      {sub && <p className="text-xs text-gray-500 mb-4">{sub}</p>}
      {children}
    </div>
  )
}

export default function EngagementPanel() {
  const [data, setData] = useState<EngagementData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/balochistan-pilot/engagement')
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || `${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  if (error) return <div className="bg-red-950 border border-red-900 rounded-xl p-5 text-red-400 text-sm">Error loading engagement data: {error}</div>
  if (!data) return <div className="text-gray-500 text-sm">Loading…</div>

  const lpData = data.engagement.map(w => ({ ...w, label: w.week.slice(5) }))
  const scoreData = data.coachingScores.map(w => ({ ...w, label: w.week.slice(5) }))

  return (
    <div className="space-y-6">
      <Panel title="Lesson Plans — % of Active Teachers Generating Weekly" sub={`Target ${data.lpWeeklyTargetPct}% of active teachers`}>
        {lpData.length === 0 ? <p className="text-gray-500 text-sm py-8 text-center">No weekly data yet.</p> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={lpData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#F1F5F9', fontWeight: 600 }} itemStyle={{ color: '#CBD5E1' }} />
              <ReferenceLine y={data.lpWeeklyTargetPct} stroke="#22C55E" strokeDasharray="4 4" label={{ value: 'Target', fill: '#22C55E', fontSize: 10, position: 'right' }} />
              <Bar dataKey="lpWeeklyPct" name="LP weekly %" fill="#FF6B57" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="Audio Coaching — Sessions Attempted per Week">
        {lpData.length === 0 ? <p className="text-gray-500 text-sm py-8 text-center">No weekly data yet.</p> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={lpData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#F1F5F9', fontWeight: 600 }} itemStyle={{ color: '#CBD5E1' }} />
              <Bar dataKey="coachingAttempted" name="Sessions attempted" fill="#3B82F6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="Audio Coaching Scores — Weekly Average" sub="Rumi's existing pedagogical rubric, reported as-is under the PITE-aligned label">
        {scoreData.length === 0 ? <p className="text-gray-500 text-sm py-8 text-center">No scored sessions yet.</p> : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={scoreData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#F1F5F9', fontWeight: 600 }} itemStyle={{ color: '#CBD5E1' }} />
              <Line type="monotone" dataKey="avgScore" name="Avg score %" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Panel>
    </div>
  )
}
