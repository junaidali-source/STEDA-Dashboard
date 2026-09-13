'use client'

import { useEffect, useState } from 'react'

interface TeacherActivityItem {
  id: string
  createdAt: string
  status: string
}

interface CoachingSessionItem extends TeacherActivityItem {
  scorePercentage: number | null
  framework: string | null
}

interface TeacherDetail {
  found: boolean
  name: string
  phoneNumber: string
  schoolName: string
  cohort: string | null
  district: string
  gender: string
  notes: string
  hasPhoneConflict: boolean
  registrationCompleted: boolean
  registeredAt: string | null
  lastActivityAt: string | null
  lessonPlans: TeacherActivityItem[]
  coachingSessions: CoachingSessionItem[]
  readingAssessments: TeacherActivityItem[]
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StatusPill({ status }: { status: string }) {
  const ok = status === 'completed'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-700 text-gray-300'}`}>
      {status}
    </span>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-white font-semibold text-sm mb-2">{title} <span className="text-gray-500 font-normal">({count})</span></h3>
      {children}
    </div>
  )
}

export default function TeacherDetailModal({ phone, onClose }: { phone: string; onClose: () => void }) {
  const [data, setData] = useState<TeacherDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setError(null)
    fetch(`/api/balochistan-pilot/teacher/${phone}`)
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || `${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [phone])

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="text-white font-semibold text-lg">{data?.found ? data.name : 'Teacher Detail'}</h2>
            {data?.found && <p className="text-xs text-gray-500 mt-0.5">{data.schoolName} · {data.district} · {data.gender}{data.cohort ? ` · ${data.cohort}` : ''}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
        </div>

        {error && <div className="bg-red-950 border border-red-900 rounded-xl p-4 text-red-400 text-sm">Error loading teacher detail: {error}</div>}
        {!error && !data && <div className="text-gray-500 text-sm">Loading…</div>}
        {!error && data && !data.found && <div className="text-gray-500 text-sm">No roster record found for this phone number.</div>}

        {!error && data?.found && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Onboarding</p>
                <p className={`text-sm font-medium mt-1 ${data.registrationCompleted ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {data.registrationCompleted ? 'Registered' : 'Pending'}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Registered</p>
                <p className="text-sm font-medium mt-1 text-gray-200">{formatDateTime(data.registeredAt)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Last Active</p>
                <p className="text-sm font-medium mt-1 text-gray-200">{formatDateTime(data.lastActivityAt)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Phone</p>
                <p className="text-sm font-medium mt-1 text-gray-200">
                  {data.phoneNumber}
                  {data.hasPhoneConflict && <span title="Shares this number with another roster row" className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">⚠</span>}
                </p>
              </div>
            </div>

            {data.notes && (
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3 text-xs text-gray-400">{data.notes}</div>
            )}

            <Section title="Lesson Plans" count={data.lessonPlans.length}>
              {data.lessonPlans.length === 0 ? (
                <p className="text-gray-500 text-sm">No lesson plan requests yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
                        <th className="py-2 pr-4 font-medium">Date</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lessonPlans.map(lp => (
                        <tr key={lp.id} className="border-b border-gray-800/60 last:border-0">
                          <td className="py-2 pr-4 text-gray-300">{formatDateTime(lp.createdAt)}</td>
                          <td className="py-2"><StatusPill status={lp.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="Coaching Sessions" count={data.coachingSessions.length}>
              {data.coachingSessions.length === 0 ? (
                <p className="text-gray-500 text-sm">No coaching sessions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
                        <th className="py-2 pr-4 font-medium">Date</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Score</th>
                        <th className="py-2 font-medium">Framework</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.coachingSessions.map(cs => (
                        <tr key={cs.id} className="border-b border-gray-800/60 last:border-0">
                          <td className="py-2 pr-4 text-gray-300">{formatDateTime(cs.createdAt)}</td>
                          <td className="py-2 pr-4"><StatusPill status={cs.status} /></td>
                          <td className="py-2 pr-4 text-gray-300">{cs.scorePercentage !== null ? `${cs.scorePercentage}%` : '—'}</td>
                          <td className="py-2 text-gray-500">{cs.framework ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="Reading Assessments" count={data.readingAssessments.length}>
              {data.readingAssessments.length === 0 ? (
                <p className="text-gray-500 text-sm">No reading assessments yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
                        <th className="py-2 pr-4 font-medium">Date</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.readingAssessments.map(ra => (
                        <tr key={ra.id} className="border-b border-gray-800/60 last:border-0">
                          <td className="py-2 pr-4 text-gray-300">{formatDateTime(ra.createdAt)}</td>
                          <td className="py-2"><StatusPill status={ra.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}
