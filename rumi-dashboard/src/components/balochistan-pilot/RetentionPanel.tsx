'use client'

import { useEffect, useState } from 'react'
import StatCard from './StatCard'

interface DropOffTeacher {
  name: string
  phoneNumber: string
  schoolName: string
  lastActivityAt: string | null
  daysSinceActive: number | null
}
interface RetentionData {
  retention: { activeMonth1: number; activeBothMonths: number; retentionPct: number }
  dropOff: DropOffTeacher[]
  dropOffDays: number
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never active'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function RetentionPanel() {
  const [data, setData] = useState<RetentionData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/balochistan-pilot/retention')
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || `${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  if (error) return <div className="bg-red-950 border border-red-900 rounded-xl p-5 text-red-400 text-sm">Error loading retention data: {error}</div>
  if (!data) return <div className="text-gray-500 text-sm">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Active in Month 1" value={data.retention.activeMonth1} sub="first 30 days from pilot start" />
        <StatCard label="Retained into Month 2" value={data.retention.activeBothMonths} />
        <StatCard label="Retention Rate" value={`${data.retention.retentionPct}%`} />
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold text-sm">Drop-off — Inactive {'>'}{data.dropOffDays} days</h3>
          <p className="text-xs text-gray-500 mt-1">Quantitative surface only — pattern review is a human, qualitative step per the MOU.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Last Active</th>
                <th className="px-6 py-3 font-medium">Days Since</th>
              </tr>
            </thead>
            <tbody>
              {data.dropOff.map((t, i) => (
                <tr key={`${t.phoneNumber}-${i}`} className="border-b border-gray-800/60 last:border-0">
                  <td className="px-6 py-3 text-gray-200">{t.name || t.phoneNumber}</td>
                  <td className="px-4 py-3 text-gray-400">{t.schoolName || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(t.lastActivityAt)}</td>
                  <td className="px-6 py-3 text-gray-400">{t.daysSinceActive ?? '—'}</td>
                </tr>
              ))}
              {data.dropOff.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No teachers currently flagged as dropped off.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
