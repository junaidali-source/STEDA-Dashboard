'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts'
import StatCard from './StatCard'
import { filterQueryString } from '@/lib/balochistan-pilot-filter-query'

interface ActivationWeek {
  week: string
  newlyRegistered: number
  cumulativeRegistered: number
  registrationPct: number
  newlyActivated: number
  cumulativeActivated: number
  activationPct: number
}

interface OverviewData {
  baseline: { totalEnrolled: number; registrationCompleted: number; onboardingCompletionPct: number; activated: number; activationPct: number }
  activation: ActivationWeek[]
  targets: { activationTargetPct: number; activationMinPct: number }
}

export default function AdoptionPanel() {
  const sp = useSearchParams()
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    fetch(`/api/balochistan-pilot/overview${filterQueryString(sp)}`)
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || `${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [sp])

  if (error) return <div className="bg-red-950 border border-red-900 rounded-xl p-5 text-red-400 text-sm">Error loading adoption data: {error}</div>
  if (!data) return <div className="text-gray-500 text-sm">Loading…</div>

  const chartData = data.activation.map(w => ({ ...w, label: w.week.slice(5) }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Enrolled Teachers" value={data.baseline.totalEnrolled} sub="DEO-confirmed roster, 20 schools" />
        <StatCard label="Onboarding Completion" value={`${data.baseline.onboardingCompletionPct}%`} sub="one-time baseline per teacher" />
        <StatCard label="Registered" value={data.baseline.registrationCompleted} sub={`${data.baseline.onboardingCompletionPct}% of roster`} />
        <StatCard label="Activated" value={data.baseline.activated} sub={`${data.baseline.activationPct}% — registered AND used the app`} />
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-white font-semibold text-sm mb-1">Registration vs. Activation (Cumulative)</h3>
        <p className="text-xs text-gray-500 mb-4">Activation target {data.targets.activationTargetPct}% · minimum acceptable {data.targets.activationMinPct}% · against the {data.baseline.totalEnrolled}-teacher confirmed roster. Registered = signed up; Activated = signed up AND used a lesson plan, coaching, or reading feature at least once.</p>
        {chartData.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">No weekly data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false}
                label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#F1F5F9', fontWeight: 600 }} itemStyle={{ color: '#CBD5E1' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={data.targets.activationTargetPct} stroke="#22C55E" strokeDasharray="4 4" label={{ value: 'Target', fill: '#22C55E', fontSize: 10, position: 'right' }} />
              <ReferenceLine y={data.targets.activationMinPct} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Min', fill: '#F59E0B', fontSize: 10, position: 'right' }} />
              <Line type="monotone" dataKey="registrationPct" name="Registered %" stroke="#38BDF8" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="activationPct" name="Activated %" stroke="#FF6B57" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
