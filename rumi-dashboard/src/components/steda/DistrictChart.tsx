'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'

interface DistrictRow {
  district: string
  listed:   number
  onboarded: number
  notYet:   number
  pct:      number
}

interface Props {
  data: DistrictRow[]
}

export default function DistrictChart({ data }: Props) {
  const top16 = data.slice(0, 16)

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h3 className="text-white font-semibold text-sm mb-4">District-wise Onboarding — Top 16 Districts</h3>
      <ResponsiveContainer width="100%" height={420}>
        <BarChart
          data={top16}
          layout="vertical"
          margin={{ top: 5, right: 60, left: 120, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="district"
            tick={{ fill: '#CBD5E1', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={115}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#F1F5F9', fontWeight: 600 }}
            itemStyle={{ color: '#CBD5E1' }}
            formatter={(value: number, name: string) => [value.toLocaleString(), name]}
          />
          <Legend
            wrapperStyle={{ color: '#CBD5E1', fontSize: 12, paddingTop: 8 }}
            formatter={(v) => <span style={{ color: '#CBD5E1' }}>{v}</span>}
          />
          <Bar dataKey="onboarded" name="Joined Rumi" stackId="a" fill="#0D9488" radius={[0, 0, 0, 0]}>
            {top16.map((entry, i) => (
              <Cell key={i} fill="#0D9488" />
            ))}
          </Bar>
          <Bar dataKey="notYet" name="Not Yet" stackId="a" fill="#1E3A5F" radius={[0, 3, 3, 0]}>
            {top16.map((entry, i) => (
              <Cell key={i} fill="#1E3A5F" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
