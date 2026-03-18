'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

interface Props {
  data: { name: string; value: number }[]
}

const COLORS = ['#0D9488', '#3B82F6', '#8B5CF6', '#F59E0B', '#22C55E', '#EC4899', '#EF4444', '#64748B']

export default function DesignationChart({ data }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h3 className="text-white font-semibold text-sm mb-4">Teacher Designation Breakdown</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#CBD5E1', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#F1F5F9', fontWeight: 600 }}
            itemStyle={{ color: '#CBD5E1' }}
            formatter={(v: number) => [v.toLocaleString(), 'Teachers']}
          />
          <Bar dataKey="value" name="Teachers" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
            <LabelList dataKey="value" position="top" style={{ fill: '#CBD5E1', fontSize: 11, fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
