'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

interface DepthRow {
  feature_count: number
  depth_label:   string
  teachers:      number
}

interface Props {
  data:        DepthRow[]
  totalJoined: number
}

const DEPTH_COLORS: Record<number, string> = {
  0: '#334155',
  1: '#3B82F6',
  2: '#F59E0B',
  3: '#22C55E',
  4: '#EC4899',
}

export default function EngagementDepthChart({ data, totalJoined }: Props) {
  const chartData = data.map(r => ({
    ...r,
    pct: totalJoined > 0 ? Math.round((r.teachers / totalJoined) * 100) : 0,
    color: DEPTH_COLORS[Math.min(r.feature_count, 4)] ?? '#64748B',
  }))

  // Summary insight
  const engaged = data.filter(r => r.feature_count > 0).reduce((s, r) => s + r.teachers, 0)
  const multiFeature = data.filter(r => r.feature_count >= 2).reduce((s, r) => s + r.teachers, 0)

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 h-full">
      <h3 className="text-white font-semibold text-sm mb-1">Teacher Engagement Depth</h3>
      <p className="text-xs text-gray-500 mb-4">How many Rumi features each teacher has tried</p>

      {/* Summary callouts */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-teal-400">{engaged.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-0.5">Used at least 1 feature</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-amber-400">{multiFeature.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-0.5">Tried 2+ features</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
          <XAxis
            dataKey="depth_label"
            tick={{ fill: '#CBD5E1', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#F1F5F9', fontWeight: 600 }}
            itemStyle={{ color: '#CBD5E1' }}
            formatter={(v: number, _: string, p: { payload: { pct: number } }) =>
              [`${v.toLocaleString()} (${p.payload.pct}%)`, 'Teachers']
            }
          />
          <Bar dataKey="teachers" name="Teachers" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
            <LabelList
              dataKey="teachers"
              position="top"
              style={{ fill: '#CBD5E1', fontSize: 11, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
