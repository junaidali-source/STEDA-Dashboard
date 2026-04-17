'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import KPIBanner             from './KPIBanner'
import FunnelChart           from './FunnelChart'
import DistrictChart         from './DistrictChart'
import DemographicsCharts    from './DemographicsCharts'
import DesignationChart      from './DesignationChart'
import TimelineChart         from './TimelineChart'
import FeatureAdoptionChart  from './FeatureAdoptionChart'
import SentimentDonut        from './SentimentDonut'
import FeatureTrendsChart    from './FeatureTrendsChart'
import EngagementDepthChart  from './EngagementDepthChart'
import TopSchoolsTable       from './TopSchoolsTable'
import StedaOnboardingSnapshot from './StedaOnboardingSnapshot'
import TorchBearersPanel       from './TorchBearersPanel'

function Spinner({ slow }: { slow?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      {slow && <p className="text-xs text-gray-500">Connecting to database…</p>}
    </div>
  )
}
function Panel({ children, loading, slow }: { children: React.ReactNode; loading: boolean; slow?: boolean }) {
  return loading
    ? <div className="bg-gray-900 rounded-xl border border-gray-800 p-5"><Spinner slow={slow} /></div>
    : <>{children}</>
}

interface FeatureStat { total: number; completed: number; users: number; completionPct: number }
interface Overview {
  totalListed: number; totalJoined: number; totalNotYet: number; anyFeatureUsers: number
  lp: FeatureStat; coaching: FeatureStat; reading: FeatureStat; video: FeatureStat; image: FeatureStat
}

const PRESETS = [
  { label: 'All Time',    from: '',                                         to: '' },
  { label: 'Last 7d',     from: daysAgo(7),                                 to: today() },
  { label: 'Last 30d',    from: daysAgo(30),                                to: today() },
  { label: 'This Month',  from: firstOfMonth(),                             to: today() },
]

function today() { return new Date().toISOString().slice(0, 10) }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
function firstOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }

export default function StedaDashboard() {
  const [from, setFrom] = useState('')
  const [to,   setTo]   = useState('')
  const [preset, setPreset] = useState('All Time')
  const [district, setDistrict] = useState('')
  const [districtOptions, setDistrictOptions] = useState<string[]>([])

  const [overview,     setOverview]     = useState<Overview | null>(null)
  const [districts,    setDistricts]    = useState<unknown[] | null>(null)
  const [demographics, setDemographics] = useState<Record<string, unknown> | null>(null)
  const [timeline,     setTimeline]     = useState<unknown[] | null>(null)
  const [sentiment,    setSentiment]    = useState<Record<string, unknown> | null>(null)
  const [adoption,     setAdoption]     = useState<unknown[] | null>(null)
  const [depth,        setDepth]        = useState<unknown[] | null>(null)
  const [trends,       setTrends]       = useState<unknown[] | null>(null)
  const [schools,      setSchools]      = useState<unknown[] | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [slow,         setSlow]         = useState(false)
  const [lastRefresh,  setLastRefresh]  = useState<Date | null>(null)
  const loadedRef = useRef(false)

  const stedaQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (district) params.set('district', district)
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }, [from, to, district])

  const fetchAll = useCallback(async () => {
    const q = stedaQuery()
    try {
      const [ov, di, de, tl, se, ad, dp, tr, sc] = await Promise.all([
        fetch(`/api/steda/overview${q}`).then(r => r.json()),
        fetch(`/api/steda/districts${q}`).then(r => r.json()),
        fetch(`/api/steda/demographics${q}`).then(r => r.json()),
        fetch(`/api/steda/timeline${q}`).then(r => r.json()),
        fetch(`/api/steda/sentiment`).then(r => r.json()),
        fetch(`/api/steda/feature-adoption${q}`).then(r => r.json()),
        fetch(`/api/steda/engagement-depth${q}`).then(r => r.json()),
        fetch(`/api/steda/feature-trends${q}`).then(r => r.json()),
        fetch(`/api/steda/top-schools${q}`).then(r => r.json()),
      ])
      if (ov.error) throw new Error(ov.error)
      setOverview(ov)
      setDistricts(Array.isArray(di) ? di : [])
      setDemographics(de)
      setTimeline(Array.isArray(tl) ? tl : [])
      setSentiment(se)
      setAdoption(Array.isArray(ad) ? ad : [])
      setDepth(Array.isArray(dp) ? dp : [])
      setTrends(Array.isArray(tr) ? tr : [])
      setSchools(Array.isArray(sc) ? sc : [])
      setLastRefresh(new Date())
      loadedRef.current = true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }, [stedaQuery])

  const fetchAllRef = useRef(fetchAll)
  fetchAllRef.current = fetchAll

  useEffect(() => {
    fetch('/api/steda/filters')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.districts)) setDistrictOptions(d.districts)
      })
      .catch(() => {})
  }, [])

  // Load + refresh when date range or geography changes; 5m poll; WhatsApp realtime for sentiment
  useEffect(() => {
    const slowTimer = setTimeout(() => { if (!loadedRef.current) setSlow(true) }, 3000)
    const deadTimer = setTimeout(() => { if (!loadedRef.current) setError('Request timed out. Refresh to retry.') }, 20000)
    loadedRef.current = false
    fetchAll().then(() => { clearTimeout(slowTimer); clearTimeout(deadTimer) })

    const refresh = setInterval(() => fetchAllRef.current(), 5 * 60 * 1000)

    const channel = supabaseBrowser
      .channel('whatsapp-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, () => {
        fetch('/api/steda/sentiment').then(r => r.json()).then(se => { if (!se.error) setSentiment(se) }).catch(() => {})
      })
      .subscribe()

    return () => {
      clearTimeout(slowTimer); clearTimeout(deadTimer)
      clearInterval(refresh)
      supabaseBrowser.removeChannel(channel)
    }
  }, [fetchAll])

  function applyPreset(p: typeof PRESETS[0]) {
    setPreset(p.label)
    setFrom(p.from)
    setTo(p.to)
    resetData()
  }

  function applyCustom() {
    setPreset('Custom')
    resetData()
    void fetchAll()
  }

  function resetData() {
    setOverview(null); setDistricts(null); setDemographics(null); setTimeline(null)
    setAdoption(null); setDepth(null); setTrends(null); setSchools(null)
    loadedRef.current = false; setSlow(false)
  }

  if (error) return (
    <div className="rounded-xl bg-red-950 border border-red-800 p-6 text-red-300 text-sm">
      <strong>Error loading STEDA data:</strong> {error}
    </div>
  )

  const ov = overview
  const refreshLabel = lastRefresh
    ? `Refreshed ${Math.floor((Date.now() - lastRefresh.getTime()) / 60000)}m ago`
    : 'Loading…'

  return (
    <div className="space-y-6">
      {/* ── Date Filter Bar ─────────────────────────────────────────── */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs text-gray-400 font-medium shrink-0">Date range:</span>
        <div className="flex gap-1 flex-wrap">
          {PRESETS.map(p => (
            <button type="button" key={p.label} onClick={() => applyPreset(p)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                preset === p.label ? 'bg-teal-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 font-medium shrink-0">District:</span>
        <select
          aria-label="Cohort district"
          title="Cohort district"
          value={district}
          onChange={(e) => { setDistrict(e.target.value); resetData() }}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-teal-500 max-w-[12rem]"
        >
          <option value="">All districts</option>
          {districtOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <input type="date" value={from} title="From date" placeholder="From"
            onChange={e => { setFrom(e.target.value); setPreset('Custom') }}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-teal-500" />
          <span className="text-gray-500 text-xs">to</span>
          <input type="date" value={to} title="To date" placeholder="To"
            onChange={e => { setTo(e.target.value); setPreset('Custom') }}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-teal-500" />
          <button type="button" onClick={applyCustom}
            className="px-3 py-1 bg-teal-700 hover:bg-teal-600 text-white text-xs rounded font-medium transition-colors">
            Apply
          </button>
          <span className="text-xs text-gray-500 shrink-0">{refreshLabel}</span>
        </div>
      </div>

      {/* ── Row 1: KPI Banner ────────────────────────────────────────── */}
      <StedaOnboardingSnapshot />

      {/* ── Row 2: KPI Banner ────────────────────────────────────────── */}
      <Panel loading={!ov} slow={slow}>
        {ov && <KPIBanner totalListed={ov.totalListed} totalJoined={ov.totalJoined}
          anyFeatureUsers={ov.anyFeatureUsers} lp={ov.lp} coaching={ov.coaching}
          reading={ov.reading} video={ov.video} image={ov.image} />}
      </Panel>

      {/* ── Row 3: Funnel + Feature Adoption ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel loading={!ov} slow={slow}>
          {ov && <FunnelChart totalListed={ov.totalListed} totalJoined={ov.totalJoined} anyFeatureUsers={ov.anyFeatureUsers} />}
        </Panel>
        <Panel loading={!adoption} slow={slow}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {adoption && ov && <FeatureAdoptionChart data={adoption as any} totalJoined={ov.totalJoined} />}
        </Panel>
      </div>

      {/* ── Row 4: Feature Trends ─────────────────────────────────────── */}
      <Panel loading={!trends} slow={slow}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {trends && <FeatureTrendsChart data={trends as any} />}
      </Panel>

      {/* ── Row 5: Engagement Depth + Top Schools ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel loading={!depth} slow={slow}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {depth && ov && <EngagementDepthChart data={depth as any} totalJoined={ov.totalJoined} />}
        </Panel>
        <Panel loading={!schools} slow={slow}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {schools && <TopSchoolsTable data={schools as any} />}
        </Panel>
      </div>

      {/* ── Row 6: Activation Timeline ───────────────────────────────── */}
      <Panel loading={!timeline} slow={slow}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {timeline && <TimelineChart data={timeline as any} />}
      </Panel>

      {/* ── Row 7: District Breakdown ────────────────────────────────── */}
      <Panel loading={!districts} slow={slow}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {districts && <DistrictChart data={districts as any} />}
      </Panel>

      {/* ── Row 8: Demographics + Designation ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel loading={!demographics} slow={slow}>
          {demographics && (
            <DemographicsCharts
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              gender={(demographics as any).gender}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              schoolType={(demographics as any).schoolType} />
          )}
        </Panel>
        <Panel loading={!demographics} slow={slow}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {demographics && <DesignationChart data={(demographics as any).designations} />}
        </Panel>
      </div>

      {/* ── Row 9: Torch Bearers — Cohort 1 ─────────────────────────── */}
      <TorchBearersPanel queryStr={stedaQuery()} />

      {/* ── Row 10: Community Sentiment ──────────────────────────────── */}
      <Panel loading={!sentiment} slow={slow}>
        {sentiment && (
          <SentimentDonut
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            totalMessages={(sentiment as any).totalMessages}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            segments={(sentiment as any).segments}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            praiseQuotes={(sentiment as any).praiseQuotes}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            issueQuotes={(sentiment as any).issueQuotes}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            totalCommunity={(sentiment as any).totalCommunity}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            lastUpdated={(sentiment as any).lastUpdated}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            liveConnected={(sentiment as any).liveConnected}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            recentMessages={(sentiment as any).recentMessages}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dailyActivity={(sentiment as any).dailyActivity}
            onRefresh={async () => {
              const se = await fetch('/api/steda/sentiment').then(r => r.json())
              if (!se.error) setSentiment(se)
            }} />
        )}
      </Panel>
    </div>
  )
}
