import { Suspense } from 'react'
import FilterBar from '@/components/FilterBar'
import Dashboard from '@/components/Dashboard'

export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Filters */}
      <Suspense>
        <FilterBar />
      </Suspense>

      {/* Dashboard panels */}
      <Suspense>
        <Dashboard />
      </Suspense>
    </main>
  )
}
