'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

interface Row {
  day:   string
  count: number
  batch: string
}

interface Props { data: Row[] }

const BATCH_COLORS: Record<string, string> = {
  'Feb 2026':  '#3B82F6',
  'Other Mar': '#94A3B8',
  'Mar 11–12': '#F59E0B',
  'Mar 13–16': '#22C55E',
}

export default function TimelineChart({ data }: Props) {
  // Shorten day labels to MM-DD
  const chartData = data.map(r => ({ ...r, label: r.day.slice(5) }))

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h3 className="text-white font-semibold text-sm mb-1">STEDA Teacher Activation Timeline</h3>
      <div className="flex gap-4 mb-4 text-xs flex-wrap">
        {Object.entries(BATCH_COLORS).filter(([k]) => k !== 'Other Mar').map(([label, color]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-gray-400">{label}</span>
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#94A3B8', fontSize: 10 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            angle={-40}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'New Users', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#F1F5F9', fontWeight: 600 }}
            itemStyle={{ color: '#CBD5E1' }}
            formatter={(v: number, _: string, p) => [v, p.payload.batch]}
          />
          <Bar dataKey="count" name="Activations" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={BATCH_COLORS[entry.batch] || '#64748B'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
