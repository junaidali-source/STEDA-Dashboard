import { Suspense } from 'react'
import StedaDashboard from '@/components/steda/StedaDashboard'

export const metadata = {
  title: 'STEDA × Rumi — Partner Report',
  description: 'Live STEDA partnership impact dashboard — Sindh, Pakistan',
}

export default function StedaPage() {
  return (
    <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page header */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-teal-400">STEDA × Rumi</h1>
            <p className="text-lg font-semibold text-white mt-0.5">Partnership Impact Report</p>
            <p className="text-sm text-gray-400 mt-1">AI-Powered Teaching Pilot — Sindh Province, Pakistan</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-amber-400 bg-gray-800 px-3 py-1 rounded-full font-medium">
              Live Data
            </span>
            <p className="text-xs text-gray-500 mt-2">Updated: March 16, 2026</p>
          </div>
        </div>
      </div>

      {/* Dashboard panels */}
      <Suspense>
        <StedaDashboard />
      </Suspense>
    </main>
  )
}
