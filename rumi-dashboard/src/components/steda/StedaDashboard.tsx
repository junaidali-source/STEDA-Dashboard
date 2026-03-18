'use client'

import { useEffect, useState, useRef } from 'react'
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

export default function StedaDashboard() {
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
  const loadedRef = useRef(false)

  useEffect(() => {
    // After 3s still loading → show "Connecting to database…"
    const slowTimer = setTimeout(() => {
      if (!loadedRef.current) setSlow(true)
    }, 3000)
    // After 20s still loading → show error
    const deadTimer = setTimeout(() => {
      if (!loadedRef.current) setError('Request timed out — the database may be unreachable. Refresh to retry.')
    }, 20000)

    const go = async () => {
      try {
        const [ov, di, de, tl, se, ad, dp, tr, sc] = await Promise.all([
          fetch('/api/steda/overview').then(r => r.json()),
          fetch('/api/steda/districts').then(r => r.json()),
          fetch('/api/steda/demographics').then(r => r.json()),
          fetch('/api/steda/timeline').then(r => r.json()),
          fetch('/api/steda/sentiment').then(r => r.json()),
          fetch('/api/steda/feature-adoption').then(r => r.json()),
          fetch('/api/steda/engagement-depth').then(r => r.json()),
          fetch('/api/steda/feature-trends').then(r => r.json()),
          fetch('/api/steda/top-schools').then(r => r.json()),
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
        loadedRef.current = true
        clearTimeout(slowTimer)
        clearTimeout(deadTimer)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      }
    }
    go()

    // Poll sentiment every 30 seconds to pick up live WhatsApp messages
    const pollSentiment = setInterval(async () => {
      try {
        const se = await fetch('/api/steda/sentiment').then(r => r.json())
        if (!se.error) setSentiment(se)
      } catch { /* ignore poll errors */ }
    }, 30_000)

    return () => {
      clearTimeout(slowTimer)
      clearTimeout(deadTimer)
      clearInterval(pollSentiment)
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-xl bg-red-950 border border-red-800 p-6 text-red-300 text-sm">
        <strong>Error loading STEDA data:</strong> {error}
      </div>
    )
  }

  const ov = overview

  return (
    <div className="space-y-6">
      {/* ── Row 1: KPI Banner ────────────────────────────────────── */}
      <Panel loading={!ov} slow={slow}>
        {ov && (
          <KPIBanner
            totalListed={ov.totalListed}
            totalJoined={ov.totalJoined}
            anyFeatureUsers={ov.anyFeatureUsers}
            lp={ov.lp}
            coaching={ov.coaching}
            reading={ov.reading}
            video={ov.video}
            image={ov.image}
          />
        )}
      </Panel>

      {/* ── Row 2: Funnel + Feature Adoption ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel loading={!ov} slow={slow}>
          {ov && (
            <FunnelChart
              totalListed={ov.totalListed}
              totalJoined={ov.totalJoined}
              anyFeatureUsers={ov.anyFeatureUsers}
            />
          )}
        </Panel>
        <Panel loading={!adoption} slow={slow}>
          {adoption && ov && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <FeatureAdoptionChart data={adoption as any} totalJoined={ov.totalJoined} />
          )}
        </Panel>
      </div>

      {/* ── Row 3: Feature Trends ─────────────────────────────────── */}
      <Panel loading={!trends} slow={slow}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {trends && <FeatureTrendsChart data={trends as any} />}
      </Panel>

      {/* ── Row 4: Engagement Depth + Top Schools ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel loading={!depth} slow={slow}>
          {depth && ov && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <EngagementDepthChart data={depth as any} totalJoined={ov.totalJoined} />
          )}
        </Panel>
        <Panel loading={!schools} slow={slow}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {schools && <TopSchoolsTable data={schools as any} />}
        </Panel>
      </div>

      {/* ── Row 5: Activation Timeline ───────────────────────────── */}
      <Panel loading={!timeline} slow={slow}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {timeline && <TimelineChart data={timeline as any} />}
      </Panel>

      {/* ── Row 6: District Breakdown ────────────────────────────── */}
      <Panel loading={!districts} slow={slow}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {districts && <DistrictChart data={districts as any} />}
      </Panel>

      {/* ── Row 7: Demographics + Designation ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel loading={!demographics} slow={slow}>
          {demographics && (
            <DemographicsCharts
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              gender={(demographics as any).gender}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              schoolType={(demographics as any).schoolType}
            />
          )}
        </Panel>
        <Panel loading={!demographics} slow={slow}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {demographics && <DesignationChart data={(demographics as any).designations} />}
        </Panel>
      </div>

      {/* ── Row 8: Community Sentiment ───────────────────────────── */}
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
          />
        )}
      </Panel>
    </div>
  )
}
