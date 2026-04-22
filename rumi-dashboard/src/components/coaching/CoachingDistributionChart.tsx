'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DistributionRow {
  sessions: number | string
  users: number
}

interface Props {
  role: string
  from: string
  to: string
  partner?: string
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
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 h-64 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-48 mb-2"></div>
        <div className="h-3 bg-gray-800 rounded w-64 mb-6"></div>
        <div className="h-48 bg-gray-800 rounded"></div>
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

  const totalUsers = data.reduce((sum, row) => sum + row.users, 0)

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 h-full">
      <h3 className="text-white font-semibold text-sm mb-1">Session Count Distribution</h3>
      <p className="text-xs text-gray-500 mb-4">Number of users by their coaching session count</p>

      <div className="bg-gray-800 rounded-lg p-3 mb-5 text-center">
        <div className="text-xl font-bold text-blue-400">{totalUsers.toLocaleString()}</div>
        <div className="text-xs text-gray-400 mt-0.5">Total users with sessions</div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
          <XAxis
            dataKey="sessions"
            tick={{ fill: '#CBD5E1', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            label={{ value: 'Session Count', position: 'insideBottomRight', offset: -5, fill: '#94A3B8', fontSize: 10 }}
          />
          <YAxis
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Number of Users', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#F1F5F9', fontWeight: 600 }}
            itemStyle={{ color: '#CBD5E1' }}
            formatter={(v: number) => [`${v.toLocaleString()} users`, 'Count']}
            labelFormatter={(label) => `${label} session${label === 1 ? '' : 's'}`}
          />
          <Bar dataKey="users" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
