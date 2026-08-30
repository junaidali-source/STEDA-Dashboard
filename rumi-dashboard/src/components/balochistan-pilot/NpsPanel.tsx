'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import StatCard from './StatCard'
import { filterQueryString } from '@/lib/balochistan-pilot-filter-query'

interface NpsData {
  nps: { available: boolean; totalResponses: number; promoters: number; passives: number; detractors: number; npsScore: number | null }
  pilotEndEstimate: string
}

export default function NpsPanel() {
  const sp = useSearchParams()
  const [data, setData] = useState<NpsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    fetch(`/api/balochistan-pilot/nps${filterQueryString(sp)}`)
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || `${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [sp])

  if (error) return <div className="bg-red-950 border border-red-900 rounded-xl p-5 text-red-400 text-sm">Error loading NPS data: {error}</div>
  if (!data) return <div className="text-gray-500 text-sm">Loading…</div>

  if (!data.nps.available) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 text-sm text-amber-400 space-y-2">
        <p>
          NPS survey not collected yet. Per the agreed approach, Rumi itself will ask teachers the
          &quot;how likely are you to recommend Rumi to a peer&quot; question at the end of the pilot
          (estimated around <strong>{data.pilotEndEstimate}</strong> — 8 weeks from school nomination;
          confirm against actual kickoff) and store each response against the teacher&apos;s phone number.
        </p>
        <p className="text-xs text-amber-400/80">
          Two things need to happen before this panel has data: (1) the Rumi WhatsApp bot needs the
          conversational NPS question built in — that&apos;s a different codebase from this dashboard;
          (2) a database migration to create the response table this panel already reads from.
        </p>
      </div>
    )
  }

  const { totalResponses, promoters, passives, detractors, npsScore } = data.nps

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="NPS Score" value={npsScore !== null ? npsScore : '—'} sub="promoters % − detractors %" />
        <StatCard label="Responses" value={totalResponses} />
        <StatCard label="Promoters (9–10)" value={promoters} />
        <StatCard label="Detractors (0–6)" value={detractors} sub={`${passives} passive`} />
      </div>
    </div>
  )
}
