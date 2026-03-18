'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'

interface TrendRow {
  day:          string
  lesson_plans: number
  coaching:     number
  reading:      number
  video:        number
  image:        number
}

interface Props { data: TrendRow[] }

const FEATURES = [
  { key: 'lesson_plans', label: 'Lesson Plans',     color: '#3B82F6' },
  { key: 'coaching',     label: 'Coaching',          color: '#F59E0B' },
  { key: 'reading',      label: 'Reading',           color: '#8B5CF6' },
  { key: 'video',        label: 'Video Generation',  color: '#22C55E' },
  { key: 'image',        label: 'Image Analysis',    color: '#EC4899' },
]

export default function FeatureTrendsChart({ data }: Props) {
  // Only include lines that have any non-zero data
  const activeFeatures = FEATURES.filter(f =>
    data.some(r => (r[f.key as keyof TrendRow] as number) > 0)
  )

  const chartData = data.map(r => ({ ...r, label: r.day.slice(5) }))

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h3 className="text-white font-semibold text-sm mb-1">Daily Feature Usage Trends</h3>
      <p className="text-xs text-gray-500 mb-4">
        Requests per day across all Rumi features
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
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
            label={{ value: 'Requests', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#F1F5F9', fontWeight: 600 }}
            itemStyle={{ color: '#CBD5E1' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(v) => <span style={{ color: '#CBD5E1' }}>{v}</span>}
          />
          {activeFeatures.map(f => (
            <Line
              key={f.key}
              type="monotone"
              dataKey={f.key}
              name={f.label}
              stroke={f.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
