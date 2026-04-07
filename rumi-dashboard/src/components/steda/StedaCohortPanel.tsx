'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { DistrictMapRow } from './StedaOnboardingMap'

const StedaOnboardingMap = dynamic(() => import('./StedaOnboardingMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] sm:h-[420px] rounded-xl border border-slate-200 bg-slate-50 animate-pulse flex items-center justify-center text-slate-500 text-sm">
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
  gender: string
  schoolType: string
  onboarded: boolean
}

interface Payload {
  totalListed: number
  totalJoined: number
  notYet: number
  onboardedPct: number
  districts: DistrictMapRow[]
  teachers: TeacherRow[]
}

function maskPhone(p: string) {
  if (p.length < 6) return p
  return `${p.slice(0, 4)}…${p.slice(-4)}`
}

export default function StedaCohortPanel() {
  const [data, setData] = useState<Payload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [status, setStatus] = useState<'all' | 'onboarded' | 'pending'>('all')

  useEffect(() => {
    fetch('/api/steda/onboarding-detail')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setData(j)
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  const districtOptions = useMemo(() => {
    if (!data) return []
    const s = new Set<string>()
    data.teachers.forEach((t) => {
      if (t.district && t.district !== '—') s.add(t.district)
    })
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [data])

  const filteredTeachers = useMemo(() => {
    if (!data) return []
    const qq = q.trim().toLowerCase()
    return data.teachers.filter((t) => {
      if (districtFilter && t.district !== districtFilter) return false
      if (status === 'onboarded' && !t.onboarded) return false
      if (status === 'pending' && t.onboarded) return false
      if (!qq) return true
      return (
        t.name.toLowerCase().includes(qq) ||
        t.school.toLowerCase().includes(qq) ||
        t.district.toLowerCase().includes(qq) ||
        t.phone.includes(qq)
      )
    })
  }, [data, q, districtFilter, status])

  if (err) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <strong>STEDA cohort</strong> — {err}
      </section>
    )
  }

  if (!data) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-10 flex justify-center">
        <div className="h-9 w-9 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 sm:px-8 py-6 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-200/90">STEDA × Rumi</p>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">Partner list onboarding</h2>
        <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
          Teachers from <code className="text-indigo-200 text-xs bg-white/10 px-1.5 py-0.5 rounded">data/STEDA List of Teachers-1 .csv</code>{' '}
          matched to platform accounts by WhatsApp number. Map shows regional density and share onboarded per district.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/steda"
            className="text-xs font-medium bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-1.5 transition"
          >
            Open STEDA report →
          </Link>
        </div>
      </div>

      <div className="p-5 sm:p-8 space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Listed cohort</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{data.totalListed.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">Rows in partner CSV (unique phones)</p>
          </div>
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-4">
            <p className="text-xs font-medium text-emerald-800 uppercase tracking-wide">Onboarded</p>
            <p className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">{data.totalJoined.toLocaleString()}</p>
            <p className="text-xs text-emerald-700/80 mt-1">Registered on Rumi</p>
          </div>
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-4">
            <p className="text-xs font-medium text-amber-900 uppercase tracking-wide">Not yet</p>
            <p className="text-2xl font-bold text-amber-800 tabular-nums mt-1">{data.notYet.toLocaleString()}</p>
            <p className="text-xs text-amber-800/80 mt-1">No matching user row</p>
          </div>
          <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/80 p-4">
            <p className="text-xs font-medium text-indigo-900 uppercase tracking-wide">Onboarding rate</p>
            <p className="text-2xl font-bold text-indigo-700 tabular-nums mt-1">{data.onboardedPct}%</p>
            <p className="text-xs text-indigo-800/80 mt-1">Joined ÷ listed</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Regional view</h3>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-600" /> ≥70%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-600" /> 40–69%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-600" /> 1–39%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> 0%
                </span>
              </div>
            </div>
            <StedaOnboardingMap districts={data.districts} />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Marker size reflects number of teachers listed in that district; colour reflects share onboarded. Positions are district centroids (Sindh), not school GPS.
            </p>
          </div>
          <div className="xl:col-span-2">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">By district</h3>
            <div className="rounded-xl border border-slate-200 max-h-[420px] overflow-auto">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-slate-100 text-slate-600 z-10">
                  <tr>
                    <th className="px-3 py-2 font-semibold">District</th>
                    <th className="px-3 py-2 font-semibold text-right">Listed</th>
                    <th className="px-3 py-2 font-semibold text-right">Onboarded</th>
                    <th className="px-3 py-2 font-semibold text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.districts.map((d) => (
                    <tr key={d.districtKey} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className="px-3 py-2 text-slate-800 font-medium">{d.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{d.listed}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{d.joined}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{d.onboardedPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Teacher list</h3>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, school, district, phone…"
              className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <select
              aria-label="Filter by district"
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All districts</option>
              {districtOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              aria-label="Filter by onboarding status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="all">All statuses</option>
              <option value="onboarded">Onboarded only</option>
              <option value="pending">Not onboarded</option>
            </select>
          </div>
          <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[min(520px,55vh)] overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-slate-100 text-slate-600 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">District</th>
                  <th className="px-3 py-2 font-semibold hidden md:table-cell">School</th>
                  <th className="px-3 py-2 font-semibold hidden lg:table-cell">Role</th>
                  <th className="px-3 py-2 font-semibold text-right">WhatsApp</th>
                  <th className="px-3 py-2 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((t) => (
                  <tr key={t.phone} className="border-t border-slate-100 hover:bg-slate-50/80">
                    <td className="px-3 py-2 text-slate-900 font-medium max-w-[140px] truncate" title={t.name}>{t.name}</td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{t.district}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate hidden md:table-cell" title={t.school}>{t.school}</td>
                    <td className="px-3 py-2 text-slate-600 hidden lg:table-cell whitespace-nowrap">{t.designation}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500 text-[11px]">{maskPhone(t.phone)}</td>
                    <td className="px-3 py-2 text-right">
                      {t.onboarded ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 font-semibold">On Rumi</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Showing {filteredTeachers.length.toLocaleString()} of {data.teachers.length.toLocaleString()} teachers · Phone numbers partially masked
          </p>
        </div>
      </div>
    </section>
  )
}
