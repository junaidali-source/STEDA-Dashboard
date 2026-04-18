'use client'

import { useState, useCallback } from 'react'
import TorchBearersPanel from '@/components/steda/TorchBearersPanel'
import CohortMessagesPanel from '@/components/steda/CohortMessagesPanel'

const PRESETS = [
  { label: 'All Time',   from: '',             to: '' },
  { label: 'Last 7d',    from: daysAgo(7),      to: today() },
  { label: 'Last 30d',   from: daysAgo(30),     to: today() },
  { label: 'This Month', from: firstOfMonth(),  to: today() },
]

function today() { return new Date().toISOString().slice(0, 10) }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
function firstOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }

export default function CohortsPage() {
  const [from,   setFrom]   = useState('')
  const [to,     setTo]     = useState('')
  const [preset, setPreset] = useState('All Time')

  const queryStr = useCallback(() => {
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to)   p.set('to', to)
    const qs = p.toString()
    return qs ? `?${qs}` : ''
  }, [from, to])

  function applyPreset(p: typeof PRESETS[0]) {
    setPreset(p.label)
    setFrom(p.from)
    setTo(p.to)
  }

  return (
    <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page header */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-amber-400">Cohorts</h1>
            <p className="text-lg font-semibold text-white mt-0.5">Teacher Cohort Analysis</p>
            <p className="text-sm text-gray-400 mt-1">Engagement tracking and similarity analysis for selected teacher cohorts</p>
          </div>
          <span className="text-xs text-amber-400 bg-gray-800 px-3 py-1 rounded-full font-medium">
            Live Data
          </span>
        </div>
      </div>

      {/* Date filter */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs text-gray-400 font-medium shrink-0">Date range:</span>
        <div className="flex gap-1 flex-wrap">
          {PRESETS.map(p => (
            <button type="button" key={p.label} onClick={() => applyPreset(p)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                preset === p.label ? 'bg-amber-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <input type="date" value={from} title="From date"
            onChange={e => { setFrom(e.target.value); setPreset('Custom') }}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-amber-500" />
          <span className="text-gray-500 text-xs">to</span>
          <input type="date" value={to} title="To date"
            onChange={e => { setTo(e.target.value); setPreset('Custom') }}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-amber-500" />
          <button type="button" onClick={() => setPreset('Custom')}
            className="px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white text-xs rounded font-medium transition-colors">
            Apply
          </button>
        </div>
      </div>

      {/* Cohort 1 — The Torch Bearers: coaching + profile */}
      <TorchBearersPanel queryStr={queryStr()} />

      {/* Community message analysis — patterns by designation and grade */}
      <CohortMessagesPanel queryStr={queryStr()} />
    </main>
  )
}
