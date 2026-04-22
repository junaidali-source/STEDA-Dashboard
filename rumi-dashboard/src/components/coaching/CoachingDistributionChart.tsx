'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceLine, defs, linearGradient, stop,
} from 'recharts'

interface DistributionRow {
  sessions: number | string
  users: number
}

interface RetentionRow {
  label: string
  pct: number
  users: number
}

interface Props {
  role: string
  from: string
  to: string
  partner?: string
}

function buildRetentionCurve(distribution: DistributionRow[]): RetentionRow[] {
  const total = distribution.reduce((s, r) => s + r.users, 0)
  if (total === 0) return []

  // Sort numerically (treat '5+' as 5 for ordering)
  const sorted = [...distribution].sort((a, b) => {
    const av = a.sessions === '5+' ? 5 : Number(a.sessions)
    const bv = b.sessions === '5+' ? 5 : Number(b.sessions)
    return av - bv
  })

  // For each bucket, users who reached AT LEAST that many sessions
  // = sum of users in this bucket and all higher buckets
  return sorted.map((row, i) => {
    const usersAtOrAbove = sorted.slice(i).reduce((s, r) => s + r.users, 0)
    return {
      label: String(row.sessions),
      pct: Math.round((usersAtOrAbove / total) * 100),
      users: usersAtOrAbove,
    }
  })
}

const CustomTooltipRetention = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as RetentionRow
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-gray-400 mb-1">{d.label === '5+' ? '5+ sessions' : `${d.label} session${d.label === '1' ? '' : 's'}`}</p>
      <p className="text-teal-300 font-bold text-sm">{d.pct}% retained</p>
      <p className="text-gray-400">{d.users} users reached this point</p>
    </div>
  )
}

const CustomTooltipDist = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const users = payload[0].value
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-gray-400 mb-1">Exactly {label === '5+' ? '5+' : label} session{label === '1' ? '' : 's'}</p>
      <p className="text-blue-300 font-bold text-sm">{users} users</p>
    </div>
  )
}

export default function CoachingDistributionChart({ role, from, to, partner }: Props) {
  const [data, setData] = useState<DistributionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDistribution = async () => {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams()
        if (from) params.append('from', from)
        if (to) params.append('to', to)
        if (role === 'steda') {
          params.append('scope', 'steda')
        } else if (partner) {
          params.append('partner', partner)
        }
        const res = await fetch(`/api/coaching/distribution?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to fetch distribution data')
        const json = await res.json()
        setData(json.distribution || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchDistribution()
  }, [role, from, to, partner])

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800 h-72 animate-pulse">
            <div className="h-4 bg-gray-800 rounded w-48 mb-2" />
            <div className="h-3 bg-gray-800 rounded w-64 mb-6" />
            <div className="h-48 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (error || !data || data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 h-64 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white font-semibold text-sm mb-1">No Session Data</p>
          <p className="text-xs text-gray-400">No coaching sessions found for the selected date range.</p>
        </div>
      </div>
    )
  }

  const totalUsers = data.reduce((s, r) => s + r.users, 0)
  const retentionCurve = buildRetentionCurve(data)

  // Find where curve plateaus (difference < 5pp between consecutive points)
  const plateau = retentionCurve.length >= 2
    ? retentionCurve.find((r, i) => i > 0 && (retentionCurve[i - 1].pct - r.pct) <= 5)
    : null

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-400 tabular-nums">{totalUsers}</div>
          <div className="text-xs text-gray-400 mt-0.5">Users with sessions</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-teal-400 tabular-nums">
            {retentionCurve[1]?.pct ?? 0}%
          </div>
          <div className="text-xs text-gray-400 mt-0.5">Returned for session 2</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className={`text-2xl font-bold tabular-nums ${plateau ? 'text-emerald-400' : 'text-red-400'}`}>
            {plateau ? 'Plateaus ✓' : 'Drops off'}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">Retention curve shape</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Bar distribution */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h3 className="text-white font-semibold text-sm mb-0.5">Session Count Distribution</h3>
          <p className="text-xs text-gray-500 mb-4">How many users completed exactly N sessions</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis
                dataKey="sessions"
                tick={{ fill: '#CBD5E1', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
                label={{ value: 'Sessions', position: 'insideBottom', offset: -2, fill: '#64748B', fontSize: 10 }}
              />
              <YAxis
                tick={{ fill: '#94A3B8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                label={{ value: 'Users', angle: -90, position: 'insideLeft', fill: '#64748B', fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltipDist />} cursor={{ fill: '#1E293B' }} />
              <Bar dataKey="users" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Right: Retention curve */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h3 className="text-white font-semibold text-sm mb-0.5">Retention Curve</h3>
          <p className="text-xs text-gray-500 mb-4">% of users who reached at least N sessions</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={retentionCurve} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="retentionGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#CBD5E1', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
                label={{ value: 'Sessions', position: 'insideBottom', offset: -2, fill: '#64748B', fontSize: 10 }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#94A3B8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
                label={{ value: '% Users', angle: -90, position: 'insideLeft', fill: '#64748B', fontSize: 10 }}
              />
              {plateau && (
                <ReferenceLine
                  x={plateau.label}
                  stroke="#34d399"
                  strokeDasharray="4 3"
                  label={{ value: 'Plateau', position: 'top', fill: '#34d399', fontSize: 10 }}
                />
              )}
              <Tooltip content={<CustomTooltipRetention />} cursor={{ stroke: '#334155' }} />
              <Area
                type="monotone"
                dataKey="pct"
                stroke="#14b8a6"
                strokeWidth={2.5}
                fill="url(#retentionGrad)"
                dot={{ fill: '#14b8a6', strokeWidth: 0, r: 4 }}
                activeDot={{ fill: '#fff', stroke: '#14b8a6', strokeWidth: 2, r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
