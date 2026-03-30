'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'

export default function ReportsPage() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function generateReport() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tracker/reports', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to generate report')
        return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `STEDA-Tracker-${new Date().toISOString().slice(0,10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Generate Report</h1>
        <p className="text-sm text-gray-500 mt-1">Download a PDF deployment report for STEDA stakeholders</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-lg">
        <h2 className="text-white font-semibold text-sm mb-2">STEDA × Rumi Fidelity Report</h2>
        <p className="text-xs text-gray-400 mb-6">
          2-page PDF including: KPI summary, deployment milestone status, feature adoption table, and open action items.
          Data pulled from the latest metric snapshot and current action items.
        </p>

        <div className="space-y-2 mb-6 text-xs text-gray-500">
          <p>✓ Page 1: Executive summary with KPIs + milestone timeline</p>
          <p>✓ Page 2: All open action items with owners and due dates</p>
          <p>✓ Formatted for ED Rasool Bux / AD Mazhar Sherazi</p>
        </div>

        {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

        <button onClick={generateReport} disabled={loading}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {loading
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            }
          </svg>
          {loading ? 'Generating PDF…' : 'Download PDF Report'}
        </button>
      </div>
    </div>
  )
}
