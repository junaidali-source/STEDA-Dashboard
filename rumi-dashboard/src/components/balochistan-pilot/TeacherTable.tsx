'use client'

import { useEffect, useState } from 'react'

interface TeacherRow {
  id: string
  name: string | null
  phoneNumber: string
  schoolName: string | null
  district: string | null
  cohort: string | null
  onboardingStatus: 'registered' | 'pending'
  lessonPlansCount: number
  coachingSessionsCount: number
  coachingAvgPercentage: number | null
  lastActivityAt: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TeacherTable() {
  const [teachers, setTeachers] = useState<TeacherRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/balochistan-pilot/teachers')
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || `${r.status}`); return r.json() })
      .then(d => setTeachers(d.teachers))
      .catch(e => setError(e.message))
  }, [])

  if (error) return <div className="bg-red-950 border border-red-900 rounded-xl p-5 text-red-400 text-sm">Error loading teachers: {error}</div>
  if (!teachers) return <div className="text-gray-500 text-sm">Loading…</div>

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h3 className="text-white font-semibold text-sm">Teacher-Level View</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">School</th>
              <th className="px-4 py-3 font-medium">District</th>
              <th className="px-4 py-3 font-medium">Cohort</th>
              <th className="px-4 py-3 font-medium">Onboarding</th>
              <th className="px-4 py-3 font-medium">Lesson Plans</th>
              <th className="px-4 py-3 font-medium">Coaching Sessions</th>
              <th className="px-4 py-3 font-medium">Coaching Score</th>
              <th className="px-6 py-3 font-medium">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map(t => (
              <tr key={t.id} className="border-b border-gray-800/60 last:border-0">
                <td className="px-6 py-3 text-gray-200">{t.name || t.phoneNumber}</td>
                <td className="px-4 py-3 text-gray-400">{t.schoolName || '—'}</td>
                <td className="px-4 py-3 text-gray-400">{t.district || '—'}</td>
                <td className="px-4 py-3 text-gray-400">{t.cohort || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${t.onboardingStatus === 'registered' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {t.onboardingStatus === 'registered' ? 'Registered' : 'Pending'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">{t.lessonPlansCount}</td>
                <td className="px-4 py-3 text-gray-400">{t.coachingSessionsCount}</td>
                <td className="px-4 py-3 text-gray-400">{t.coachingAvgPercentage !== null ? `${t.coachingAvgPercentage}%` : '—'}</td>
                <td className="px-6 py-3 text-gray-400">{formatDate(t.lastActivityAt)}</td>
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-500">No teachers found for this pilot yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
