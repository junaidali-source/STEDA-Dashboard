'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Snapshot {
  snapshot_date: string
  joined_pct: number; used_any_pct: number
  lp_completion: number; coaching_teachers: number
}

export default function MetricChart({ snapshots }: { snapshots: Snapshot[] }) {
  const data = [...snapshots].reverse().map(s => ({
    date:     s.snapshot_date,
    Joined:   s.joined_pct,
    'Used Any': s.used_any_pct,
    'LP Completion': s.lp_completion,
    Coaching: s.coaching_teachers,
  }))

  if (data.length === 0) return (
    <div className="flex items-center justify-center h-40 text-gray-500 text-sm">No snapshots yet — add one below</div>
  )

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
        <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} />
        <YAxis tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#F1F5F9' }} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
        <Line type="monotone" dataKey="Joined"       stroke="#6366F1" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Used Any"     stroke="#22C55E" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="LP Completion" stroke="#0D9488" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Coaching"     stroke="#F59E0B" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
