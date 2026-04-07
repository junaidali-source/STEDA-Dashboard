'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

const COUNTRIES = [
  { code: 'all', label: 'All Countries' },
  { code: '92',  label: '🇵🇰 Pakistan'  },
  { code: '94',  label: '🇱🇰 Sri Lanka' },
  { code: '96',  label: '🇲🇲 Myanmar'   },
]

interface Partner { id: string; name: string; domain: string; teacher_count: number }

export default function FilterBar() {
  const router = useRouter()
  const sp     = useSearchParams()

  const country      = sp.get('country')      || 'all'
  const school       = sp.get('school')       || ''
  const partner      = sp.get('partner')      || ''
  const from         = sp.get('from')         || ''
  const to           = sp.get('to')           || ''
  const compare_from = sp.get('compare_from') || ''
  const compare_to   = sp.get('compare_to')   || ''

  const [schoolInput,   setSchoolInput]   = useState(school)
  const [suggestions,   setSuggestions]   = useState<string[]>([])
  const [showSug,       setShowSug]       = useState(false)
  const [partners,      setPartners]      = useState<Partner[]>([])
  const [fromInput,     setFromInput]     = useState(from)
  const [toInput,       setToInput]       = useState(to)
  const [showCompare,   setShowCompare]   = useState(compare_from !== '' || compare_to !== '')
  const [compFrom,      setCompFrom]      = useState(compare_from)
  const [compTo,        setCompTo]        = useState(compare_to)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/partners')
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setPartners(data))
      .catch(() => {})
  }, [])

  const push = useCallback(
    (c: string, s: string, pt: string, f: string, t: string, cf: string, ct: string) => {
      const params = new URLSearchParams()
      if (c !== 'all') params.set('country', c)
      if (s)           params.set('school',  s)
      if (pt)          params.set('partner', pt)
      if (f)           params.set('from',    f)
      if (t)           params.set('to',      t)
      if (cf)          params.set('compare_from', cf)
      if (ct)          params.set('compare_to',   ct)
      router.push(`/?${params.toString()}`)
    },
    [router]
  )

  useEffect(() => {
    if (!schoolInput.trim()) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const q   = encodeURIComponent(schoolInput)
      const res = await fetch(
        `/api/school-search?q=${q}&country=${country}&partner=${encodeURIComponent(partner)}`
      )
      if (res.ok) setSuggestions(await res.json())
    }, 300)
  }, [schoolInput, country, partner])

  const handleApply = () =>
    push(
      country, schoolInput, partner,
      fromInput, toInput,
      showCompare ? compFrom : '',
      showCompare ? compTo   : '',
    )

  const handleClear = () => {
    setSchoolInput(''); setFromInput(''); setToInput('')
    setCompFrom('');    setCompTo('');    setShowCompare(false)
    push('all', '', '', '', '', '', '')
  }

  const hasFilter = country !== 'all' || schoolInput || partner || fromInput || toInput

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm shadow-slate-200/50">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 shrink-0">Filters</span>

        {/* Country */}
        <select
          value={country}
          onChange={(e) => push(e.target.value, schoolInput, partner, fromInput, toInput, showCompare ? compFrom : '', showCompare ? compTo : '')}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>

        {/* Partner */}
        <select
          value={partner}
          onChange={(e) => push(country, schoolInput, e.target.value, fromInput, toInput, showCompare ? compFrom : '', showCompare ? compTo : '')}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
        >
          <option value="">All Partners</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              🤝 {p.name} ({p.teacher_count} teachers)
            </option>
          ))}
        </select>

        {/* School search */}
        <div className="relative">
          <input
            type="text"
            placeholder="🏫 Search school…"
            value={schoolInput}
            onChange={(e) => setSchoolInput(e.target.value)}
            onFocus={() => setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-52 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {showSug && suggestions.length > 0 && (
            <ul className="absolute z-50 top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto text-sm">
              {suggestions.map((s) => (
                <li
                  key={s}
                  className="px-3 py-2 hover:bg-indigo-50 cursor-pointer"
                  onMouseDown={() => {
                    setSchoolInput(s); setShowSug(false)
                    push(country, s, partner, fromInput, toInput, showCompare ? compFrom : '', showCompare ? compTo : '')
                  }}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">📅 From</span>
          <input
            type="date"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <span className="text-xs text-gray-500">to</span>
          <input
            type="date"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Compare toggle */}
        <button
          onClick={() => setShowCompare((v) => !v)}
          className={`text-sm px-3 py-1.5 rounded-lg border transition ${
            showCompare
              ? 'bg-amber-100 border-amber-400 text-amber-700 font-semibold'
              : 'border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-600'
          }`}
        >
          ⚖️ Compare
        </button>

        {/* Apply */}
        <button
          onClick={handleApply}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition"
        >
          Apply
        </button>

        {/* Clear */}
        {hasFilter && (
          <button
            onClick={handleClear}
            className="text-sm text-gray-500 hover:text-red-500 underline"
          >
            Clear all
          </button>
        )}

        {/* Active filter badges */}
        <div className="flex flex-wrap gap-2 ml-1">
          {country !== 'all' && (
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full">
              {COUNTRIES.find((c) => c.code === country)?.label}
            </span>
          )}
          {partner && (
            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">
              🤝 {partners.find((p) => p.id === partner)?.name ?? 'Partner'}
            </span>
          )}
          {schoolInput && (
            <span className="bg-teal-100 text-teal-700 text-xs px-2 py-1 rounded-full">
              🏫 {schoolInput}
            </span>
          )}
          {(from || to) && (
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
              📅 {from || '…'} → {to || 'now'}
            </span>
          )}
        </div>
      </div>

      {/* ── Compare period row ── */}
      {showCompare && (
        <div className="flex flex-wrap items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 shadow-sm">
          <span className="font-semibold text-amber-700 text-sm">⚖️ Compare period:</span>
          <span className="text-xs text-amber-600">From</span>
          <input
            type="date"
            value={compFrom}
            onChange={(e) => setCompFrom(e.target.value)}
            className="border border-amber-300 rounded-lg px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-xs text-amber-600">to</span>
          <input
            type="date"
            value={compTo}
            onChange={(e) => setCompTo(e.target.value)}
            className="border border-amber-300 rounded-lg px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            onClick={handleApply}
            className="bg-amber-500 hover:bg-amber-600 text-white text-sm px-3 py-1.5 rounded-lg transition"
          >
            Apply comparison
          </button>
          {(compare_from || compare_to) && (
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">
              vs 📅 {compare_from || '…'} → {compare_to || 'now'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
