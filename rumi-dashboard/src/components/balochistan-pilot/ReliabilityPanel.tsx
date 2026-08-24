'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ReliabilityMonth { month: string; attempted: number; audioUploadSuccessPct: number; aiResponseSuccessPct: number }
interface ReliabilityData { reliability: ReliabilityMonth[] }

export default function ReliabilityPanel() {
  const [data, setData] = useState<ReliabilityData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/balochistan-pilot/reliability')
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || `${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  if (error) return <div className="bg-red-950 border border-red-900 rounded-xl p-5 text-red-400 text-sm">Error loading reliability data: {error}</div>
  if (!data) return <div className="text-gray-500 text-sm">Loading…</div>

  const chartData = data.reliability.map(m => ({ ...m, label: m.month.slice(0, 7) }))

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h3 className="text-white font-semibold text-sm mb-1">System Reliability — Monthly</h3>
      <p className="text-xs text-gray-500 mb-4">
        Audio upload success = sessions with a stored recording, of all attempted. AI response success = of those uploaded, how many reached a completed analysis.
      </p>
      {chartData.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No coaching sessions attempted yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#F1F5F9', fontWeight: 600 }} itemStyle={{ color: '#CBD5E1' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
            <Line type="monotone" dataKey="audioUploadSuccessPct" name="Audio upload %" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="aiResponseSuccessPct" name="AI response %" stroke="#FF6B57" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
