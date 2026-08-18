import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { verifySessionToken } from '@/lib/auth'
import {
  getScopedRoster, getLiveJoinStatus, resolveLiveStatus, resolveUsage, summarizeLive,
  type OnboardingScope, type LiveStatus,
} from '@/lib/onboarding-tracker'
import StedaDashboard from '@/components/steda/StedaDashboard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Rumi Onboarding Tracker',
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

const STATUS_LABEL: Record<LiveStatus, string> = {
  active:  'Active',
  joined:  'Onboarded',
  pending: 'Pending',
}

function StatusPill({ status }: { status: LiveStatus }) {
  const styles: Record<LiveStatus, string> = {
    active:  'bg-emerald-500/15 text-emerald-400',
    joined:  'bg-sky-500/15 text-sky-400',
    pending: 'bg-amber-500/15 text-amber-400',
  }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function OnboardingTrackerPage() {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) redirect('/login')
  if (!['admin', 'principal', 'deo'].includes(session.role)) redirect('/')

  const scope: OnboardingScope =
    session.role === 'principal' && session.scope ? { type: 'school', value: session.scope } :
    session.role === 'deo'       && session.scope ? { type: 'district', value: session.scope } :
    null

  const rows = getScopedRoster(scope)
  let liveStatus: Awaited<ReturnType<typeof getLiveJoinStatus>> = {}
  let liveStatusError = false
  try {
    liveStatus = await getLiveJoinStatus(rows.map(r => r.whatsappIntl))
  } catch (e) {
    console.error('onboarding-tracker: live status lookup failed', e)
    liveStatusError = true
  }
  const stats = summarizeLive(rows, liveStatus, liveStatusError)

  const scopeLabel =
    scope?.type === 'school'   ? scope.value :
    scope?.type === 'district' ? `${scope.value} District` :
    'All Schools'

  return (
    <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h1 className="text-2xl font-bold text-teal-400">Rumi Onboarding Tracker</h1>
        <p className="text-sm text-gray-400 mt-1">{scopeLabel}</p>
      </div>

      {liveStatusError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-3 text-sm text-amber-400">
          Couldn&apos;t reach the live usage database — showing the last verified status snapshot instead of real-time data.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Staff" value={stats.total} />
        <StatCard label="Onboarded" value={stats.onboarded} sub={`${stats.onboardedPct}% have a Rumi account`} />
        <StatCard label="Active" value={stats.active} sub="completed a feature" />
        <StatCard label="Pending" value={stats.pending} sub="no Rumi account yet" />
        <StatCard label="Lesson Plans" value={stats.totalLp} sub="created across staff" />
        <StatCard label="Coaching Sessions" value={stats.totalCoaching} sub="completed across staff" />
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm">Staff Roster</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Class</th>
                {scope?.type !== 'school' && <th className="px-4 py-3 font-medium">School</th>}
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Lesson Plans</th>
                <th className="px-4 py-3 font-medium">Coaching</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const usage = resolveUsage(r, liveStatus, liveStatusError)
                return (
                  <tr key={r.sno} className="border-b border-gray-800/60 last:border-0">
                    <td className="px-6 py-3 text-gray-200">{r.name}</td>
                    <td className="px-4 py-3 text-gray-400">{r.role}</td>
                    <td className="px-4 py-3 text-gray-400">{r.subject || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{r.className || '—'}</td>
                    {scope?.type !== 'school' && <td className="px-4 py-3 text-gray-400">{r.school}</td>}
                    <td className="px-4 py-3 text-gray-400">{r.whatsappLocal || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {usage.lpCompleted > 0
                        ? <span className="text-gray-200 font-medium">{usage.lpCompleted}<span className="text-gray-500 font-normal"> · {formatDate(usage.lpLastDate)}</span></span>
                        : <span className="text-gray-600">0</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {usage.coachingCompleted > 0
                        ? <span className="text-gray-200 font-medium">{usage.coachingCompleted}<span className="text-gray-500 font-normal"> · {formatDate(usage.coachingLastDate)}</span></span>
                        : <span className="text-gray-600">0</span>}
                    </td>
                    <td className="px-6 py-3"><StatusPill status={resolveLiveStatus(r, liveStatus, liveStatusError)} /></td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">No staff records found for this scope.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {session.role === 'deo' && scope?.type === 'district' && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-bold text-teal-400">District Program Impact</h2>
            <p className="text-sm text-gray-400 mt-1">All STEDA-cohort schools in {scope.value}</p>
          </div>
          <Suspense>
            <StedaDashboard lockedDistrict={scope.value} scoped />
          </Suspense>
        </div>
      )}
    </main>
  )
}
