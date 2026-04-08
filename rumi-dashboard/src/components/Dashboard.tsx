'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import KPICards from './KPICards'
import GrowthChart from './GrowthChart'
import FeatureChart from './FeatureChart'
import SchoolsTable from './SchoolsTable'
import DiscoverabilityPanel from './DiscoverabilityPanel'
import StedaCohortPanel from './steda/StedaCohortPanel'

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

export default function Dashboard() {
  const sp           = useSearchParams()
  const country      = sp.get('country')      || 'all'
  const region       = sp.get('region')       || ''
  const school       = sp.get('school')       || ''
  const partner      = sp.get('partner')      || ''
  const from         = sp.get('from')         || ''
  const to           = sp.get('to')           || ''
  const compare_from = sp.get('compare_from') || ''
  const compare_to   = sp.get('compare_to')   || ''

  const [kpis,     setKpis]     = useState<KPIData | null>(null)
  const [kpisPrev, setKpisPrev] = useState<KPIData | null>(null)
  const [growth,   setGrowth]   = useState<unknown[] | null>(null)
  const [features, setFeatures] = useState<unknown[] | null>(null)
  const [schools,  setSchools]  = useState<unknown[] | null>(null)
  const [disc,     setDisc]     = useState<unknown[] | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setKpis(null); setError(null)
    try {
      const base = { country, region, school, partner, from, to }
      const q    = buildQS(base)
      const qCmp = buildQS({ ...base, compare_from, compare_to })

      const [k, g, f, s, d] = await Promise.all([
        fetch(`/api/kpis?${qCmp}`).then((r) => r.json()),
        fetch(`/api/user-growth?${q}`).then((r) => r.json()),
        fetch(`/api/feature-usage?${q}`).then((r) => r.json()),
        fetch(`/api/top-schools?${q}`).then((r) => r.json()),
        fetch(`/api/discoverability?${q}`).then((r) => r.json()),
      ])

      if (k.error) throw new Error(k.error)
      setKpis(k.current)
      setKpisPrev(k.previous ?? null)
      setGrowth(Array.isArray(g) ? g : [])
      setFeatures(Array.isArray(f) ? f : [])
      setSchools(Array.isArray(s) ? s : [])
      setDisc(Array.isArray(d) ? d : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }, [country, region, school, partner, from, to, compare_from, compare_to])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-red-700 text-sm">
        <strong>Database error:</strong> {error}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <StedaCohortPanel />

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
    </div>
  )
}
