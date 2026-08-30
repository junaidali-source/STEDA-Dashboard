'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface FilterOptions {
  districts: string[]
  schools: { name: string; district: string }[]
  genders: string[]
}

// Shared across every tab — district/school/gender/search live in the URL
// (?district=&school=&gender=&q=) so switching tabs never loses the current
// filter, and each panel just reads the same params when it fetches.
export default function PilotFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const district = sp.get('district') || ''
  const school = sp.get('school') || ''
  const gender = sp.get('gender') || ''
  const q = sp.get('q') || ''

  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [qInput, setQInput] = useState(q)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/balochistan-pilot/filters')
      .then(r => (r.ok ? r.json() : null))
      .then(setOptions)
      .catch(() => {})
  }, [])

  useEffect(() => setQInput(q), [q])

  const push = useCallback((next: { district?: string; school?: string; gender?: string; q?: string }) => {
    const params = new URLSearchParams(sp.toString())
    const merged = { district, school, gender, q, ...next }
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, sp, district, school, gender, q])

  const schoolsForDistrict = options?.schools.filter(s => !district || s.district === district) ?? []
  const hasFilters = !!(district || school || gender || q)

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-wrap items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 shrink-0">Filters</span>

      <input
        type="text"
        placeholder="🔎 Search teacher or school…"
        value={qInput}
        onChange={(e) => {
          setQInput(e.target.value)
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => push({ q: e.target.value }), 350)
        }}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 w-56 focus:outline-none focus:ring-2 focus:ring-coral/40"
      />

      <select
        aria-label="District"
        value={district}
        onChange={(e) => push({ district: e.target.value, school: '' })}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-coral/40"
      >
        <option value="">All Districts</option>
        {options?.districts.map(d => <option key={d} value={d}>{d}</option>)}
      </select>

      <select
        aria-label="School"
        value={school}
        onChange={(e) => push({ school: e.target.value })}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-coral/40 max-w-[220px]"
      >
        <option value="">All Schools</option>
        {schoolsForDistrict.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
      </select>

      <select
        aria-label="Gender"
        value={gender}
        onChange={(e) => push({ gender: e.target.value })}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-coral/40"
      >
        <option value="">All Genders</option>
        {options?.genders.map(g => <option key={g} value={g}>{g}</option>)}
      </select>

      {hasFilters && (
        <button
          onClick={() => { setQInput(''); router.push(pathname) }}
          className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}
