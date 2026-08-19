'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import StatCard from './StatCard'

interface ActivationWeek {
  week: string
  signups: number
  registered: number
  cumulativeSignups: number
  cumulativeRegistered: number
  activationPct: number
}

interface TrueActivation {
  matchedRegistered: number
  enrolledKnownTotal: number
  schoolsWithKnownCount: number
  schoolsWithUnknownCount: number
  isPartial: boolean
  activationPct: number | null
}

interface OverviewData {
  baseline: { totalConsidered: number; registrationCompleted: number; onboardingCompletionPct: number }
  activation: ActivationWeek[]
  trueActivation: TrueActivation
  targets: { activationTargetPct: number; activationMinPct: number }
}

export default function AdoptionPanel() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/balochistan-pilot/overview')
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || `${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  if (error) return <div className="bg-red-950 border border-red-900 rounded-xl p-5 text-red-400 text-sm">Error loading adoption data: {error}</div>
  if (!data) return <div className="text-gray-500 text-sm">Loading…</div>

  const chartData = data.activation.map(w => ({ ...w, label: w.week.slice(5) }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Considered Teachers" value={data.baseline.totalConsidered} sub="self-reported region, since Jul 2026" />
        <StatCard label="Onboarding Completion" value={`${data.baseline.onboardingCompletionPct}%`} sub="one-time baseline per teacher" />
        <StatCard label="Registered" value={data.baseline.registrationCompleted} />
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-white font-semibold text-sm mb-1">Activation Rate — vs. DEO-Nominated Headcount</h3>
        <p className="text-xs text-gray-500 mb-4">
          {data.trueActivation.enrolledKnownTotal > 0
            ? `${data.trueActivation.matchedRegistered} registered of ${data.trueActivation.enrolledKnownTotal} nominated`
            : 'No nominated headcount known yet'}
          {data.trueActivation.isPartial && ` — headcount known for ${data.trueActivation.schoolsWithKnownCount} of ${data.trueActivation.schoolsWithKnownCount + data.trueActivation.schoolsWithUnknownCount} schools (Zhob only); this is a floor, not the true rate, until Quetta's counts arrive.`}
        </p>
        <p className="text-3xl font-bold text-white">
          {data.trueActivation.activationPct !== null ? `${data.trueActivation.activationPct}%` : '—'}
        </p>
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-white font-semibold text-sm mb-1">Activation Rate (Cumulative)</h3>
        <p className="text-xs text-gray-500 mb-4">Target {data.targets.activationTargetPct}% · minimum acceptable {data.targets.activationMinPct}%</p>
        {chartData.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">No weekly data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false}
                label={{ value: 'Activation %', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#F1F5F9', fontWeight: 600 }} itemStyle={{ color: '#CBD5E1' }} />
              <ReferenceLine y={data.targets.activationTargetPct} stroke="#22C55E" strokeDasharray="4 4" label={{ value: 'Target', fill: '#22C55E', fontSize: 10, position: 'right' }} />
              <ReferenceLine y={data.targets.activationMinPct} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Min', fill: '#F59E0B', fontSize: 10, position: 'right' }} />
              <Line type="monotone" dataKey="activationPct" name="Activation %" stroke="#FF6B57" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
