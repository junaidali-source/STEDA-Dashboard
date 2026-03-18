'use client'

import { useEffect, useState } from 'react'
import CohortPanel from './CohortPanel'
import type { CohortData } from '@/types/cohort'

interface WeekOption {
  week_start: string   // "2026-02-17"
  week_label: string   // "Feb 17 - Feb 23, 2026"
  user_count: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Return the ISO Monday (YYYY-MM-DD) for the week containing dateStr. */
function toWeekStart(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()                       // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day       // shift to Monday
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

/** Human-readable "Mon DD - Mon DD, YYYY" for a week starting on weekStart. */
function formatWeekRange(weekStart: string): string {
  if (!weekStart) return ''
  const start = new Date(weekStart + 'T00:00:00')
  const end   = new Date(weekStart + 'T00:00:00')
  end.setDate(end.getDate() + 6)
  const fmt     = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const fmtFull = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt(start)} - ${fmtFull(end)}`
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function PlaceholderPanel({ color }: { color: 'blue' | 'orange' }) {
  const border = color === 'blue' ? 'border-indigo-200' : 'border-orange-200'
  const bg     = color === 'blue' ? 'bg-indigo-50'     : 'bg-orange-50'
  const text   = color === 'blue' ? 'text-indigo-400'  : 'text-orange-400'
  return (
    <div className={`rounded-xl border-2 border-dashed ${border} ${bg} flex items-center justify-center py-24`}>
      <p className={`text-sm ${text} font-medium`}>Select a cohort week above</p>
    </div>
  )
}

/** Calendar date picker that snaps to ISO week Monday */
function WeekPicker({
  label, value, onChange, accentColor, weeks,
}: {
  label: string
  value: string          // selected week_start (YYYY-MM-DD) or ''
  onChange: (weekStart: string) => void
  accentColor: 'blue' | 'orange'
  weeks: WeekOption[]
}) {
  const dot    = accentColor === 'blue' ? 'bg-indigo-500'  : 'bg-orange-500'
  const border = accentColor === 'blue' ? 'border-indigo-300 focus:ring-indigo-400' : 'border-orange-300 focus:ring-orange-400'
  const chip   = accentColor === 'blue' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'

  // The date input value is the week_start itself (so it stays on the picker)
  function handleDateChange(dateStr: string) {
    const ws = toWeekStart(dateStr)
    onChange(ws)
  }

  // Find user_count for the selected week
  const matchedWeek = weeks.find((w) => w.week_start === value)

  return (
    <div className="flex flex-col gap-1.5 min-w-56">
      {/* Label */}
      <div className="flex items-center gap-1.5">
        <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <span className="text-sm font-semibold text-gray-700">{label}</span>
      </div>

      {/* Date input */}
      <div className={`relative border-2 ${border} rounded-xl overflow-hidden bg-white shadow-sm`}>
        <div className="flex items-center">
          {/* Calendar icon area */}
          <div className={`px-3 py-2 border-r ${accentColor === 'blue' ? 'border-indigo-200 bg-indigo-50' : 'border-orange-200 bg-orange-50'}`}>
            <svg className={`w-4 h-4 ${accentColor === 'blue' ? 'text-indigo-500' : 'text-orange-500'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <input
            type="date"
            value={value}
            onChange={(e) => handleDateChange(e.target.value)}
            aria-label={`Pick a date for ${label}`}
            title={`Pick any day — the week containing that date will be selected`}
            className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-gray-700 cursor-pointer"
          />
        </div>
      </div>

      {/* Selected week label */}
      {value ? (
        <div className={`text-xs font-medium px-2 py-1 rounded-lg ${chip} flex items-center justify-between`}>
          <span>📅 {formatWeekRange(value)}</span>
          {matchedWeek && (
            <span className="ml-2 opacity-70">{matchedWeek.user_count.toLocaleString()} users</span>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400 pl-1">Pick any day — we&apos;ll snap to that week</p>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function CohortReport() {
  const [weeks,        setWeeks]        = useState<WeekOption[]>([])
  const [weeksLoading, setWeeksLoading] = useState(true)
  const [weeksError,   setWeeksError]   = useState<string | null>(null)
  const [weekA,        setWeekA]        = useState('')
  const [weekB,        setWeekB]        = useState('')
  const [dataA,        setDataA]        = useState<CohortData | null>(null)
  const [dataB,        setDataB]        = useState<CohortData | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Fetch available weeks on mount (for user_count badges)
  useEffect(() => {
    setWeeksLoading(true)
    fetch('/api/cohort/weeks')
      .then(async (r) => {
        const json = await r.json()
        if (json && typeof json === 'object' && 'error' in json) {
          throw new Error(String((json as { error: unknown }).error))
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        if (Array.isArray(json)) setWeeks(json as WeekOption[])
        else throw new Error('Unexpected response from /api/cohort/weeks')
      })
      .catch((e: unknown) => {
        setWeeksError(e instanceof Error ? e.message : 'Failed to load cohort weeks')
      })
      .finally(() => setWeeksLoading(false))
  }, [])

  async function handleCompare() {
    if (!weekA && !weekB) return
    setLoading(true)
    setError(null)
    setDataA(null)
    setDataB(null)

    try {
      const fetchWeek = async (week: string): Promise<CohortData | null> => {
        if (!week) return null
        const res  = await fetch(`/api/cohort/report?week=${week}`)
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const label = weeks.find((w) => w.week_start === week)?.week_label
          ?? formatWeekRange(week)
        return { ...json, week_label: label } as CohortData
      }

      const [a, b] = await Promise.all([fetchWeek(weekA), fetchWeek(weekB)])
      setDataA(a)
      setDataB(b)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load cohort data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Weeks API error ── */}
      {weeksError && !weeksLoading && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          <strong>Failed to load cohort weeks:</strong> {weeksError}
        </div>
      )}

      {/* ── Selector card ── */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Select cohort weeks to compare
        </p>

        <div className="flex flex-wrap items-end gap-6">
          <WeekPicker
            label="Cohort A"
            value={weekA}
            onChange={setWeekA}
            accentColor="blue"
            weeks={weeks}
          />

          {/* VS divider */}
          <div className="flex items-center justify-center w-8 h-9 rounded-full bg-gray-100 text-xs font-bold text-gray-400 self-center mb-1">
            VS
          </div>

          <WeekPicker
            label="Cohort B"
            value={weekB}
            onChange={setWeekB}
            accentColor="orange"
            weeks={weeks}
          />

          {/* Actions */}
          <div className="flex items-center gap-3 self-end mb-0.5">
            <button
              onClick={handleCompare}
              disabled={(!weekA && !weekB) || loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed
                text-white text-sm px-6 py-2.5 rounded-xl transition font-semibold shadow-sm"
              type="button"
            >
              {loading ? 'Loading…' : 'Compare →'}
            </button>

            {(weekA || weekB || dataA || dataB) && (
              <button
                type="button"
                onClick={() => { setWeekA(''); setWeekB(''); setDataA(null); setDataB(null); setError(null) }}
                className="text-sm text-gray-400 hover:text-red-500 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Available weeks hint */}
        {!weeksLoading && !weeksError && weeks.length > 0 && (
          <p className="mt-3 text-xs text-gray-400">
            {weeks.length} weeks with data · most recent: <strong className="text-gray-500">{weeks[0]?.week_label}</strong>
          </p>
        )}
      </div>

      {/* ── Compare error ── */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          <strong>Error loading cohort data:</strong> {error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && <Spinner />}

      {/* ── Side-by-side panels ── */}
      {!loading && (dataA || dataB) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {dataA ? <CohortPanel data={dataA} other={dataB} color="blue"   /> : <PlaceholderPanel color="blue"   />}
          {dataB ? <CohortPanel data={dataB} other={dataA} color="orange" /> : <PlaceholderPanel color="orange" />}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !dataA && !dataB && !error && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <PlaceholderPanel color="blue"   />
            <PlaceholderPanel color="orange" />
          </div>
          <p className="text-center text-sm text-gray-400 -mt-2">
            Pick dates above and click <strong className="text-gray-600">Compare →</strong>
          </p>
        </>
      )}
    </div>
  )
}
