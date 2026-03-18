'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Segment { name: string; value: number }

interface Props {
  gender:     Segment[]
  schoolType: Segment[]
}

const GENDER_COLORS     = ['#EC4899', '#3B82F6', '#94A3B8']
const SCHOOL_COLORS     = ['#0D9488', '#F59E0B', '#94A3B8']

function PiePanel({ title, data, colors }: { title: string; data: Segment[]; colors: string[] }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 flex-1">
      <h4 className="text-white font-semibold text-sm mb-3 text-center">{title}</h4>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={0}
            outerRadius={80}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={{ stroke: '#475569' }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} stroke="#0F172A" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#F1F5F9' }}
            itemStyle={{ color: '#CBD5E1' }}
            formatter={(v: number) => [v.toLocaleString(), '']}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function DemographicsCharts({ gender, schoolType }: Props) {
  return (
    <div className="flex gap-4">
      <PiePanel title="Gender Distribution" data={gender}     colors={GENDER_COLORS} />
      <PiePanel title="School Type"          data={schoolType} colors={SCHOOL_COLORS} />
    </div>
  )
}
