'use client'

import { useState } from 'react'
import AdoptionPanel from '@/components/balochistan-pilot/AdoptionPanel'
import EngagementPanel from '@/components/balochistan-pilot/EngagementPanel'
import RetentionPanel from '@/components/balochistan-pilot/RetentionPanel'
import ReliabilityPanel from '@/components/balochistan-pilot/ReliabilityPanel'
import TeacherTable from '@/components/balochistan-pilot/TeacherTable'
import SchoolCohortTable from '@/components/balochistan-pilot/SchoolCohortTable'
import NpsPanel from '@/components/balochistan-pilot/NpsPanel'
import { PILOT_START } from '@/lib/balochistan-pilot-constants'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'adoption',    label: 'Adoption' },
  { key: 'engagement',  label: 'Engagement' },
  { key: 'retention',   label: 'Retention' },
  { key: 'reliability', label: 'Reliability' },
  { key: 'teachers',    label: 'Teachers' },
  { key: 'schools',     label: 'Schools & Cohorts' },
  { key: 'nps',         label: 'User Experience (NPS)' },
] as const

type TabKey = typeof TABS[number]['key']

export default function BalochistanPilotPage() {
  const [tab, setTab] = useState<TabKey>('adoption')

  return (
    <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="bg-navy-dark rounded-xl p-6 border border-white/10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-coral">Rumi</p>
        <h1 className="text-2xl font-bold text-white mt-1">Balochistan SED Pilot</h1>
        <p className="text-sm text-gray-400 mt-1">
          20 schools · District Quetta &amp; District Zhob · reporting period since {PILOT_START}
        </p>

        <div className="flex gap-1 mt-5 border-t border-white/10 pt-4 flex-wrap">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-coral text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'adoption' && <AdoptionPanel />}
      {tab === 'engagement' && <EngagementPanel />}
      {tab === 'retention' && <RetentionPanel />}
      {tab === 'reliability' && <ReliabilityPanel />}
      {tab === 'teachers' && <TeacherTable />}
      {tab === 'schools' && <SchoolCohortTable />}
      {tab === 'nps' && <NpsPanel />}
    </main>
  )
}
