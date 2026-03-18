'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'

export interface FeatureRow {
  feature:        string
  users:          number
  requests:       number
  completed:      number
  completion_pct: number
}

const FEATURE_COLORS: Record<string, string> = {
  'Lesson Plans':     '#3B82F6',
  'Coaching Sessions': '#F59E0B',
  'Reading Assessments': '#8B5CF6',
  'Video Generation': '#22C55E',
  'Image Analysis':   '#EC4899',
}

interface Props {
  data:        FeatureRow[]
  totalJoined: number
}

export default function FeatureAdoptionChart({ data, totalJoined }: Props) {
  const chartData = data.map(r => ({
    ...r,
    adoptionPct: totalJoined > 0 ? Math.round((r.users / totalJoined) * 100) : 0,
    color: FEATURE_COLORS[r.feature] ?? '#64748B',
  }))

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 h-full">
      <h3 className="text-white font-semibold text-sm mb-1">Feature Adoption by Teachers</h3>
      <p className="text-xs text-gray-500 mb-4">% of joined teachers who tried each feature</p>

      {/* Horizontal adoption bars */}
      <div className="space-y-3 mb-6">
        {chartData.map((row) => (
          <div key={row.feature}>
            <div className="flex justify-between items-center mb-1">
              <span className="flex items-center gap-2 text-xs text-gray-300">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                {row.feature}
              </span>
              <span className="text-xs text-gray-400">
                <span className="font-semibold text-white">{row.users.toLocaleString()}</span>
                {' '}teachers · {row.completion_pct}% completion
              </span>
            </div>
            <div className="h-5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                style={{
                  width: `${Math.max(row.adoptionPct, 1)}%`,
                  backgroundColor: row.color,
                  opacity: row.users === 0 ? 0.3 : 1,
                }}
              >
                {row.adoptionPct >= 8 && (
                  <span className="text-white text-xs font-bold">{row.adoptionPct}%</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Requests bar chart */}
      <p className="text-xs text-gray-500 mb-2">Total requests per feature</p>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
          <XAxis
            dataKey="feature"
            tick={false}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#F1F5F9', fontWeight: 600 }}
            itemStyle={{ color: '#CBD5E1' }}
            formatter={(v: number, _: string, p: { payload: { feature: string } }) =>
              [v.toLocaleString(), p.payload.feature]
            }
          />
          <Bar dataKey="requests" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
            <LabelList
              dataKey="requests"
              position="top"
              style={{ fill: '#CBD5E1', fontSize: 10, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
