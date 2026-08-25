'use client'

import { useEffect, useState } from 'react'

interface SchoolCohortRollup {
  district: string
  cohort: string
  schoolName: string
  emisCode: string
  teacherCount: number
  registeredCount: number
  lessonPlansTotal: number
  coachingSessionsTotal: number
}
interface SchoolCohortResult { available: boolean; rollups: SchoolCohortRollup[] }

export default function SchoolCohortTable() {
  const [data, setData] = useState<SchoolCohortResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/balochistan-pilot/schools')
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || `${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  if (error) return <div className="bg-red-950 border border-red-900 rounded-xl p-5 text-red-400 text-sm">Error loading school/cohort data: {error}</div>
  if (!data) return <div className="text-gray-500 text-sm">Loading…</div>

  if (!data.available) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 text-sm text-amber-400">
        Teacher roster not yet available — waiting on the DEO-confirmed 20-school teacher list.
      </div>
    )
  }

  const cohortsPending = data.rollups.every(r => !r.cohort)

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h3 className="text-white font-semibold text-sm">Schools &amp; Cohorts — District Quetta &amp; Zhob</h3>
        {cohortsPending && (
          <p className="text-xs text-amber-400 mt-1">WhatsApp cohort assignments not yet provided by SED — school/district rollups below are exact.</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
              <th className="px-6 py-3 font-medium">School</th>
              <th className="px-4 py-3 font-medium">District</th>
              <th className="px-4 py-3 font-medium">Cohort</th>
              <th className="px-4 py-3 font-medium">Teachers</th>
              <th className="px-4 py-3 font-medium">Registered</th>
              <th className="px-4 py-3 font-medium">Lesson Plans</th>
              <th className="px-6 py-3 font-medium">Coaching Sessions</th>
            </tr>
          </thead>
          <tbody>
            {data.rollups.map(r => (
              <tr key={`${r.district}-${r.cohort}-${r.schoolName}`} className="border-b border-gray-800/60 last:border-0">
                <td className="px-6 py-3 text-gray-200">{r.schoolName}</td>
                <td className="px-4 py-3 text-gray-400">{r.district}</td>
                <td className="px-4 py-3 text-gray-400">{r.cohort}</td>
                <td className="px-4 py-3 text-gray-400">{r.teacherCount}</td>
                <td className="px-4 py-3 text-gray-400">{r.registeredCount}</td>
                <td className="px-4 py-3 text-gray-400">{r.lessonPlansTotal}</td>
                <td className="px-6 py-3 text-gray-400">{r.coachingSessionsTotal}</td>
              </tr>
            ))}
            {data.rollups.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No teachers matched to a pilot school yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
