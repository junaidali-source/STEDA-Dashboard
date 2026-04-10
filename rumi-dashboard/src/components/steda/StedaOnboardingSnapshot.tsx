'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import type { DistrictMapRow } from './StedaOnboardingMap'

const StedaOnboardingMap = dynamic(() => import('./StedaOnboardingMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] sm:h-[420px] rounded-xl border border-gray-800 bg-gray-900 animate-pulse flex items-center justify-center text-gray-400 text-sm">
      Loading map…
    </div>
  ),
})

interface TeacherRow {
  phone: string
  name: string
  school: string
  district: string
  designation: string
  onboarded: boolean
}

interface Payload {
  totalListed: number
  totalJoined: number
  totalEngaged: number
  notYet: number
  onboardedPct: number
  engagementPct: number
  districts: DistrictMapRow[]
  teachers: TeacherRow[]
}

function escCsv(v: string) {
  const s = v ?? ''
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function StedaOnboardingSnapshot() {
  const [data, setData] = useState<Payload | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/steda/onboarding-detail')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setData(j)
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load onboarding snapshot'))
  }, [])

  const pending = useMemo(() => (data?.teachers || []).filter((t) => !t.onboarded), [data])

  function downloadPendingCsv() {
    if (!pending.length) return
    const head = ['name', 'district', 'school', 'designation', 'whatsapp', 'status']
    const rows = pending.map((t) =>
      [t.name || '', t.district || '', t.school || '', t.designation || '', t.phone || '', 'not_onboarded']
        .map(escCsv)
        .join(',')
    )
    const csv = [head.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `steda-not-onboarded-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (err) {
    return <div className="rounded-xl bg-red-950 border border-red-800 p-4 text-sm text-red-300">{err}</div>
  }
  if (!data) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-white font-semibold">Onboarding Snapshot (STEDA cohort)</h3>
        <button
          type="button"
          onClick={downloadPendingCsv}
          className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition"
        >
          Download Not Onboarded CSV ({pending.length})
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 min-h-[112px] flex flex-col justify-between">
          <p className="text-[11px] font-semibold tracking-wide text-slate-300 uppercase">Teachers listed</p>
          <p className="text-3xl font-bold text-white tabular-nums leading-none">{data.totalListed.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-emerald-700/70 bg-emerald-950/60 p-4 min-h-[112px] flex flex-col justify-between">
          <p className="text-[11px] font-semibold tracking-wide text-emerald-200 uppercase">Joined Rumi</p>
          <p className="text-3xl font-bold text-emerald-100 tabular-nums leading-none">{data.totalJoined.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-amber-700/70 bg-amber-950/55 p-4 min-h-[112px] flex flex-col justify-between">
          <p className="text-[11px] font-semibold tracking-wide text-amber-200 uppercase">Not yet onboarded</p>
          <p className="text-3xl font-bold text-amber-100 tabular-nums leading-none">{data.notYet.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-cyan-700/70 bg-cyan-950/55 p-4 min-h-[112px] flex flex-col justify-between">
          <p className="text-[11px] font-semibold tracking-wide text-cyan-200 uppercase">Onboarding rate</p>
          <p className="text-3xl font-bold text-cyan-100 tabular-nums leading-none">{data.onboardedPct}%</p>
        </div>
        <div className="rounded-xl border border-indigo-700/70 bg-indigo-950/60 p-4 min-h-[112px] col-span-2 lg:col-span-1 flex flex-col justify-between">
          <p className="text-[11px] font-semibold tracking-wide text-indigo-200 uppercase">Engagement</p>
          <p className="text-3xl font-bold text-indigo-100 tabular-nums leading-none">{data.engagementPct}%</p>
          <p className="text-xs text-indigo-100/95 mt-2 leading-snug">
            {data.totalEngaged.toLocaleString()} onboarded with ≥1 feature
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3 space-y-2">
          <StedaOnboardingMap districts={data.districts} />
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Fill = onboarding rate (joined ÷ listed). Ring = engagement among onboarded (teachers with ≥1 feature,
            all-time).
          </p>
        </div>
        <div className="xl:col-span-2 flex flex-col min-h-0">
          <p className="text-xs font-medium text-gray-300 mb-2">By district</p>
          <div className="rounded-xl border border-slate-700/90 bg-slate-950 max-h-[420px] overflow-auto shadow-inner ring-1 ring-white/5">
            <table className="w-full text-sm text-left">
              <caption className="sr-only">Onboarding counts and rates per district in the STEDA cohort</caption>
              <thead className="sticky top-0 z-10 bg-slate-800 shadow-sm">
                <tr className="text-left text-white">
                  <th scope="col" className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wide">District</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-right">Listed</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-right">Onboarded</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-right">%</th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-right"
                    title="Share of onboarded teachers with at least one Rumi feature (all-time)"
                  >
                    Eng.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/90">
                {data.districts.map((d, i) => (
                  <tr
                    key={d.districtKey}
                    className={`transition-colors hover:bg-slate-800/70 ${i % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900/70'}`}
                  >
                    <td className="px-3 py-2.5 font-medium text-zinc-100">{d.label}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-100">{d.listed}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-400">{d.joined}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-cyan-300">{d.onboardedPct}%</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-indigo-300" title={`${d.engaged} of ${d.joined} onboarded`}>
                      {d.engagementPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

