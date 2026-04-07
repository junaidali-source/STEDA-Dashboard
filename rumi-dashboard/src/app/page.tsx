import { Suspense } from 'react'
import FilterBar from '@/components/FilterBar'
import Dashboard from '@/components/Dashboard'

export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        <header className="border-b border-slate-200/80 pb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-600">Rumi Analytics</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">Partner dashboard</h1>
          <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
            STEDA cohort onboarding from the partner teacher list, then platform-wide usage and schools. Use filters below to narrow by country, partner, or dates.
          </p>
        </header>

        <Suspense>
          <FilterBar />
        </Suspense>

        <Suspense>
          <Dashboard />
        </Suspense>
      </div>
    </main>
  )
}
