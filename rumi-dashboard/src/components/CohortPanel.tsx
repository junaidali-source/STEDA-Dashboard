'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts'
import type { CohortData } from '@/types/cohort'

interface Props {
  data: CohortData
  other: CohortData | null
  color: 'blue' | 'orange'
}

// Delta badge comparing current vs other cohort value
function Delta({ current, other, isRate = false }: { current: number; other: number; isRate?: boolean }) {
  if (other === 0 && current === 0) return null
  const diff = current - other
  if (diff === 0) return null
  const up = diff > 0
  const display = isRate
    ? `${Math.abs(diff).toFixed(1)}pp`
    : other !== 0
      ? `${Math.abs(Math.round((diff / Math.abs(other)) * 100))}%`
      : '–'
  return (
    <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
      up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {up ? '↑' : '↓'} {display}
    </span>
  )
}

// Funnel step component
function FunnelStep({
  label, count, total, pct, isFirst,
}: {
  label: string; count: number; total: number; pct?: number; isFirst?: boolean
}) {
  const barWidth = total > 0 ? Math.max(20, Math.round((count / total) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-right text-xs text-gray-500 shrink-0">{label}</div>
      <div className="flex-1">
        <div
          className={`h-7 rounded flex items-center px-2 text-white text-xs font-semibold transition-all ${
            isFirst ? 'bg-indigo-500' : 'bg-indigo-400'
          }`}
          style={{ width: `${barWidth}%`, minWidth: 32 }}
        >
          {count.toLocaleString()}
        </div>
      </div>
      {pct !== undefined && (
        <div className="w-14 text-xs text-gray-500 shrink-0">{pct}%</div>
      )}
    </div>
  )
}

// Pct bar for behavior table
function PctBar({ value }: { value: number | null }) {
  const v = value ?? 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(v, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-700 w-10 text-right">{v > 0 ? `${v}%` : '–'}</span>
    </div>
  )
}

export default function CohortPanel({ data, other, color }: Props) {
  const s = data.summary
  const otherS = other?.summary ?? null

  const accentBg   = color === 'blue' ? 'bg-indigo-600' : 'bg-orange-500'
  const accentText = color === 'blue' ? 'text-indigo-700' : 'text-orange-700'
  const accentBorder = color === 'blue' ? 'border-indigo-200' : 'border-orange-200'
  const accentHeader = color === 'blue' ? 'bg-indigo-50' : 'bg-orange-50'

  return (
    <div className={`bg-white rounded-xl border-2 ${accentBorder} overflow-hidden`}>
      {/* Header */}
      <div className={`${accentHeader} px-5 py-3 border-b ${accentBorder}`}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cohort Week</p>
        <p className={`text-base font-bold ${accentText}`}>{data.week_label}</p>
      </div>

      <div className="p-5 space-y-6">
        {/* ── KPI Summary Cards ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Total Users</p>
            <p className="text-xl font-bold text-gray-800 mt-0.5">
              {s.total_users.toLocaleString()}
            </p>
            {otherS && <Delta current={s.total_users} other={otherS.total_users} />}
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Registered</p>
            <p className="text-xl font-bold text-green-700 mt-0.5">
              {s.registered.toLocaleString()}
            </p>
            {otherS && <Delta current={s.registered} other={otherS.registered} />}
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Reg. Rate</p>
            <p className="text-xl font-bold text-teal-700 mt-0.5">{s.reg_rate}%</p>
            {otherS && <Delta current={s.reg_rate} other={otherS.reg_rate} isRate />}
          </div>
        </div>

        {/* ── Registration Funnel ── */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Registration Funnel
          </h4>
          <div className="space-y-2">
            <FunnelStep label="Joined"     count={s.total_users}  total={s.total_users} isFirst />
            <FunnelStep label="≥ 1 msg"   count={s.sent_1_plus}  total={s.total_users}
              pct={s.total_users > 0 ? Math.round((s.sent_1_plus / s.total_users) * 100) : 0} />
            <FunnelStep label="≥ 10 msgs" count={s.sent_10_plus} total={s.total_users}
              pct={s.total_users > 0 ? Math.round((s.sent_10_plus / s.total_users) * 100) : 0} />
            <FunnelStep label="Registered" count={s.registered}  total={s.total_users}
              pct={s.total_users > 0 ? Math.round((s.registered / s.total_users) * 100) : 0} />
          </div>
        </div>

        {/* ── Message Distribution ── */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Message Distribution
          </h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.message_buckets} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number, name: string) => [v.toLocaleString(), name]}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" name="All Users" fill="#6366f1" radius={[3, 3, 0, 0]}>
                {data.message_buckets.map((_, i) => (
                  <Cell key={i} fill={color === 'blue' ? '#6366f1' : '#f97316'} />
                ))}
              </Bar>
              <Bar dataKey="registered" name="Registered" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Registered vs Unregistered Behavior ── */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Registered vs Unregistered
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left font-medium py-1.5 pr-3">Metric</th>
                  <th className="text-center font-medium py-1.5 px-2 text-green-700">Registered ({s.registered})</th>
                  <th className="text-center font-medium py-1.5 px-2 text-gray-500">Unregistered ({s.unregistered})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr>
                  <td className="py-2 pr-3 text-xs text-gray-600">Avg Messages</td>
                  <td className="py-2 px-2 text-center font-semibold text-green-700">{s.reg_avg_messages ?? '–'}</td>
                  <td className="py-2 px-2 text-center text-gray-600">{s.unreg_avg_messages ?? '–'}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 text-xs text-gray-600">Active Days</td>
                  <td className="py-2 px-2 text-center font-semibold text-green-700">{s.reg_avg_days ?? '–'}</td>
                  <td className="py-2 px-2 text-center text-gray-600">{s.unreg_avg_days ?? '–'}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 text-xs text-gray-600">Lesson Plans</td>
                  <td className="py-2 px-2"><PctBar value={s.reg_lp_pct} /></td>
                  <td className="py-2 px-2"><PctBar value={s.unreg_lp_pct} /></td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 text-xs text-gray-600">Coaching</td>
                  <td className="py-2 px-2"><PctBar value={s.reg_cs_pct} /></td>
                  <td className="py-2 px-2"><PctBar value={s.unreg_cs_pct} /></td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 text-xs text-gray-600">Reading Tests</td>
                  <td className="py-2 px-2"><PctBar value={s.reg_ra_pct} /></td>
                  <td className="py-2 px-2"><PctBar value={s.unreg_ra_pct} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Country Breakdown ── */}
        {data.countries.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Country Breakdown
            </h4>
            <div className="flex flex-wrap gap-2">
              {data.countries.map((c) => (
                <div key={c.cc} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                  <span className="font-medium text-gray-700">{c.label}</span>
                  <span className="ml-2 text-gray-500">
                    {c.total} users · {c.registered} reg'd
                    {c.total > 0 ? ` (${Math.round((c.registered / c.total) * 100)}%)` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accent bottom bar */}
        <div className={`h-1 rounded-full ${accentBg} opacity-30`} />
      </div>
    </div>
  )
}
