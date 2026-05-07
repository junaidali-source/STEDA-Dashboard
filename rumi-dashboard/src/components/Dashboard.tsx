'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import KPICards from './KPICards'
import GrowthChart from './GrowthChart'
import FeatureChart from './FeatureChart'
import SchoolsTable from './SchoolsTable'
import DiscoverabilityPanel from './DiscoverabilityPanel'
import UserUsageTable from './UserUsageTable'
import CostTracker from './CostTracker'

function buildQS(params: Record<string, string>): string {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v) })
  return p.toString()
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

interface KPIData {
  total_users: number
  registered: number
  reg_rate: number
  total_messages: number
  lesson_plans: number
  coaching: number
  reading: number
}

interface UserSession {
  role: string
}

export default function Dashboard() {
  const sp           = useSearchParams()
  const router       = useRouter()
  const country      = sp.get('country')      || 'all'
  const region       = sp.get('region')       || ''
  const school       = sp.get('school')       || ''
  const partner      = sp.get('partner')      || ''
  const from         = sp.get('from')         || ''
  const to           = sp.get('to')           || ''
  const compare_from = sp.get('compare_from') || ''
  const compare_to   = sp.get('compare_to')   || ''
  const tab          = sp.get('tab')          || 'overview'

  const [kpis,     setKpis]     = useState<KPIData | null>(null)
  const [kpisPrev, setKpisPrev] = useState<KPIData | null>(null)
  const [growth,   setGrowth]   = useState<unknown[] | null>(null)
  const [features, setFeatures] = useState<unknown[] | null>(null)
  const [schools,  setSchools]  = useState<unknown[] | null>(null)
  const [disc,     setDisc]     = useState<unknown[] | null>(null)
  const [users,    setUsers]    = useState<unknown[] | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [session,  setSession]  = useState<UserSession | null>(null)

  // Get user session from API
  useEffect(() => {
    const getSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setSession(data)
        }
      } catch (e) {
        console.error('Failed to fetch session:', e)
      }
    }
    getSession()
  }, [])

  const fetchAll = useCallback(async () => {
    setKpis(null); setError(null)
    try {
      const base = { country, region, school, partner, from, to }
      const q    = buildQS(base)
      const qCmp = buildQS({ ...base, compare_from, compare_to })

      const [k, g, f, s, d, u] = await Promise.all([
        fetch(`/api/kpis?${qCmp}`).then((r) => r.json()),
        fetch(`/api/user-growth?${q}`).then((r) => r.json()),
        fetch(`/api/feature-usage?${q}`).then((r) => r.json()),
        fetch(`/api/top-schools?${q}`).then((r) => r.json()),
        fetch(`/api/discoverability?${q}`).then((r) => r.json()),
        fetch(`/api/user-usage?${q}&limit=60`).then((r) => r.json()),
      ])

      if (k.error) throw new Error(k.error)
      setKpis(k.current)
      setKpisPrev(k.previous ?? null)
      setGrowth(Array.isArray(g) ? g : [])
      setFeatures(Array.isArray(f) ? f : [])
      setSchools(Array.isArray(s) ? s : [])
      setDisc(Array.isArray(d) ? d : [])
      setUsers(Array.isArray(u) ? u : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }, [country, region, school, partner, from, to, compare_from, compare_to])

  useEffect(() => { fetchAll() }, [fetchAll])

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(sp.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`?${params.toString()}`)
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-red-700 text-sm">
        <strong>Database error:</strong> {error}
      </div>
    )
  }

  const isAdmin = session ? session.role === 'admin' : null

  return (
    <div className="space-y-8">
      {/* Date Range Filters */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="from-date" className="text-xs font-semibold text-slate-500 uppercase block mb-2">From Date</label>
          <input
            id="from-date"
            type="date"
            value={from}
            onChange={(e) => updateFilter('from', e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label htmlFor="to-date" className="text-xs font-semibold text-slate-500 uppercase block mb-2">To Date</label>
          <input
            id="to-date"
            type="date"
            value={to}
            onChange={(e) => updateFilter('to', e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label htmlFor="country-code" className="text-xs font-semibold text-slate-500 uppercase block mb-2">Country Code</label>
          <input
            id="country-code"
            type="text"
            placeholder="+92"
            value={country}
            onChange={(e) => updateFilter('country', e.target.value || 'all')}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-32"
            maxLength={3}
            title="Enter country code (e.g., 92 for Pakistan)"
          />
        </div>
        {from || to ? (
          <button
            type="button"
            onClick={() => {
              updateFilter('from', '')
              updateFilter('to', '')
            }}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            Clear
          </button>
        ) : null}
      </div>

      {/* Tabs - Admin only */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => router.push('?tab=overview')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
            tab === 'overview'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => router.push(`?tab=costs${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`)}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
            tab === 'costs'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Costs (Admin)
        </button>
      </div>

      {/* Overview Tab */}
      {tab !== 'costs' && (
        <>
          {!kpis ? (
            <Spinner />
          ) : (
            <div className="border-t border-slate-200 pt-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-4">Platform analytics</p>
              <KPICards data={kpis} previous={kpisPrev} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {growth ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <GrowthChart data={growth as any} />
            ) : <div className="bg-white rounded-xl border p-5"><Spinner /></div>}

            {features ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <FeatureChart data={features as any} />
            ) : <div className="bg-white rounded-xl border p-5"><Spinner /></div>}
          </div>

          {schools ? (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <SchoolsTable data={schools as any} />
          ) : <div className="bg-white rounded-xl border p-5"><Spinner /></div>}

          {disc ? (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <DiscoverabilityPanel data={disc as any} />
          ) : <div className="bg-white rounded-xl border p-5"><Spinner /></div>}

          {users ? (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <UserUsageTable data={users as any} />
          ) : <div className="bg-white rounded-xl border p-5"><Spinner /></div>}
        </>
      )}

      {/* Costs Tab (Admin Only) */}
      {tab === 'costs' && (
        <>
          {isAdmin === null ? (
            <Spinner />
          ) : isAdmin ? (
            <CostTracker />
          ) : (
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-6 text-yellow-700 text-sm">
              <strong>Admin access required.</strong> The Costs tab is only available to administrators.
            </div>
          )}
        </>
      )}
    </div>
  )
}
