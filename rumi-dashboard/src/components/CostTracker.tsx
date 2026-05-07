'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface CostData {
  feature: string
  count: number
  unit_cost: number
  total_cost: number
}

interface PartnerCost {
  organization: string
  videos: number
  lessons: number
  coaching: number
  reading: number
  total_cost: number
}

interface CountryCost {
  country_code: string
  videos: number
  lessons: number
  coaching: number
  reading: number
  total_cost: number
}

interface DailyCost {
  date: string
  videos: number
  lessons: number
  coaching: number
  reading: number
  total_cost: number
}

interface CostsResponse {
  total_cost: number
  cost_model: Record<string, number>
  feature_costs: CostData[]
  partner_costs: PartnerCost[]
  country_costs: CountryCost[]
  daily_costs: DailyCost[]
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']
const FEATURE_NAMES: Record<string, string> = {
  video: 'Video Generation',
  lesson_plan: 'Lesson Plans',
  coaching: 'Coaching Sessions',
  reading: 'Reading Assessments',
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`
}

function buildQS(params: Record<string, string>): string {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v) })
  return p.toString()
}

export default function CostTracker() {
  const sp = useSearchParams()
  const country = sp.get('country') || 'all'
  const from = sp.get('from') || ''
  const to = sp.get('to') || ''

  const [data, setData] = useState<CostsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetch_data = useCallback(async () => {
    setData(null)
    setError(null)
    try {
      const q = buildQS({ country, from, to })
      const res = await fetch(`/api/costs?${q}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to fetch costs')
      }
      setData(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }, [country, from, to])

  useEffect(() => { fetch_data() }, [fetch_data])

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-red-700 text-sm">
        <strong>Error:</strong> {error}
      </div>
    )
  }

  if (!data) {
    return <Spinner />
  }

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Total Cost</p>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(data.total_cost)}</p>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Video Cost</p>
          <p className="text-3xl font-bold text-blue-600">
            {formatCurrency(data.feature_costs.find(f => f.feature === 'video')?.total_cost || 0)}
          </p>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Top Partner</p>
          <p className="text-lg font-bold text-slate-900">{data.partner_costs[0]?.organization || 'N/A'}</p>
          <p className="text-sm text-slate-500">{formatCurrency(data.partner_costs[0]?.total_cost || 0)}</p>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Total Requests</p>
          <p className="text-3xl font-bold text-slate-900">
            {data.feature_costs.reduce((sum, f) => sum + f.count, 0)}
          </p>
        </div>
      </div>

      {/* Feature Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Cost Pie */}
        <div className="bg-white rounded-xl border p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Feature Breakdown (Cost %)</p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.feature_costs.map(f => ({
                  name: FEATURE_NAMES[f.feature] || f.feature,
                  value: f.total_cost,
                }))}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {data.feature_costs.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Feature Count Bar */}
        <div className="bg-white rounded-xl border p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Requests per Feature</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.feature_costs.map(f => ({
              name: FEATURE_NAMES[f.feature] || f.feature,
              count: f.count,
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Cost Trend */}
      <div className="bg-white rounded-xl border p-6">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Daily Cost Trend</p>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data.daily_costs}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value) => formatCurrency(value as number)} />
            <Legend />
            <Line type="monotone" dataKey="total_cost" stroke="#6366f1" name="Total Cost" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Partner Costs Table */}
      <div className="bg-white rounded-xl border p-6">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Cost by Partner Organization</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3 text-right">Videos</th>
                <th className="px-4 py-3 text-right">Lessons</th>
                <th className="px-4 py-3 text-right">Coaching</th>
                <th className="px-4 py-3 text-right">Reading</th>
                <th className="px-4 py-3 text-right">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.partner_costs.slice(0, 10).map((partner, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{partner.organization}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{partner.videos}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{partner.lessons}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{partner.coaching}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{partner.reading}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(partner.total_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Country Costs Table */}
      <div className="bg-white rounded-xl border p-6">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Cost by Country (Phone Code)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Country Code</th>
                <th className="px-4 py-3 text-right">Videos</th>
                <th className="px-4 py-3 text-right">Lessons</th>
                <th className="px-4 py-3 text-right">Coaching</th>
                <th className="px-4 py-3 text-right">Reading</th>
                <th className="px-4 py-3 text-right">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.country_costs.slice(0, 10).map((country, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">+{country.country_code}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{country.videos}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{country.lessons}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{country.coaching}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{country.reading}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(country.total_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
