import { Suspense } from 'react'
import CohortReport from '@/components/CohortReport'

export default function ReportPage() {
  return (
    <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Cohort Report</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Compare two cohort weeks side by side — each cohort contains all users who joined during that calendar week
        </p>
      </div>
      <Suspense>
        <CohortReport />
      </Suspense>
    </main>
  )
}
