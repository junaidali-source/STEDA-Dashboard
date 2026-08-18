import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { verifySessionToken } from '@/lib/auth'
import {
  getScopedRoster, getLiveJoinStatus, getCoachingDetails, resolveLiveStatus, resolveUsage, summarizeLive,
  type OnboardingScope, type LiveStatus, type FeatureStat,
} from '@/lib/onboarding-tracker'
import { featureColor } from '@/lib/feature-colors'
import StedaDashboard from '@/components/steda/StedaDashboard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Rumi Dashboard',
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

function FeatureCard({ label, stat }: { label: string; stat: FeatureStat }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: featureColor(label) }} />
        {label}
      </p>
      <p className="text-2xl font-bold text-white mt-1">{stat.completed}</p>
      <p className="text-xs text-gray-500 mt-0.5">{stat.teachers} teacher{stat.teachers === 1 ? '' : 's'}</p>
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

export default async function OnboardingTrackerPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) redirect('/login')
  if (!['admin', 'principal', 'deo'].includes(session.role)) redirect('/')

  const tab = searchParams.tab === 'coaching' ? 'coaching' : 'overview'

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
      <div className="bg-navy-dark rounded-xl p-6 border border-white/10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-coral">Rumi</p>
        <h1 className="text-2xl font-bold text-white mt-1">{scopeLabel}</h1>
        <p className="text-sm text-gray-400 mt-1">Teacher usage and coaching progress on Rumi</p>

        {session.role !== 'principal' && (
          <div className="flex gap-1 mt-5 border-t border-white/10 pt-4">
            <Link href="?tab=overview"
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                tab === 'overview' ? 'bg-coral text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}>
              Overview
            </Link>
            <Link href="?tab=coaching"
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                tab === 'coaching' ? 'bg-coral text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}>
              Coaching
            </Link>
          </div>
        )}
      </div>

      {liveStatusError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-3 text-sm text-amber-400">
          Couldn&apos;t reach the live usage database — showing the last verified status snapshot instead of real-time data.
        </div>
      )}

      {session.role === 'principal' ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Teachers Listed" value={stats.total} />
            <StatCard label="Joined Rumi" value={stats.onboarded} sub={`${stats.onboardedPct}% of listed`} />
            <StatCard label="Used Any Feature" value={stats.usedAnyFeature} sub={`${stats.usedAnyFeaturePct}% of joined`} />
            <StatCard label="Not Yet Onboarded" value={stats.pending} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <FeatureCard label="Lesson Plans" stat={stats.features.lessonPlans} />
            <FeatureCard label="Coaching" stat={stats.features.coaching} />
            <FeatureCard label="Reading" stat={stats.features.reading} />
            <FeatureCard label="Video Generation" stat={stats.features.video} />
            <FeatureCard label="Image Analysis" stat={stats.features.image} />
          </div>

          <CoachingDetailSection rows={rows} liveStatusError={liveStatusError} />
        </>
      ) : (
        <>
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard label="Total Staff" value={stats.total} />
                <StatCard label="Onboarded" value={stats.onboarded} sub={`${stats.onboardedPct}% have a Rumi account`} />
                <StatCard label="Active" value={stats.active} sub="completed a feature" />
                <StatCard label="Pending" value={stats.pending} sub="no Rumi account yet" />
                <StatCard label="Lesson Plans" value={stats.totalLp} sub="created across staff" />
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
                            <td className="px-6 py-3"><StatusPill status={resolveLiveStatus(r, liveStatus, liveStatusError)} /></td>
                          </tr>
                        )
                      })}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-8 text-center text-gray-500">No staff records found for this scope.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {session.role === 'deo' && scope?.type === 'district' && (
                <div className="space-y-4">
                  <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                    <h2 className="text-xl font-bold text-coral">District Program Impact</h2>
                    <p className="text-sm text-gray-400 mt-1">All STEDA-cohort schools in {scope.value}</p>
                  </div>
                  <Suspense>
                    <StedaDashboard lockedDistrict={scope.value} scoped />
                  </Suspense>
                </div>
              )}
            </>
          )}

          {tab === 'coaching' && (
            <CoachingDetailSection rows={rows} liveStatusError={liveStatusError} />
          )}
        </>
      )}
    </main>
  )
}

async function CoachingDetailSection({
  rows,
  liveStatusError,
}: {
  rows: Awaited<ReturnType<typeof getScopedRoster>>
  liveStatusError: boolean
}) {
  let coaching: Awaited<ReturnType<typeof getCoachingDetails>> = {}
  let coachingError = liveStatusError
  if (!liveStatusError) {
    try {
      coaching = await getCoachingDetails(rows.map(r => r.whatsappIntl))
    } catch (e) {
      console.error('onboarding-tracker: coaching detail lookup failed', e)
      coachingError = true
    }
  }

  const withSessions = rows.filter(r => coaching[r.whatsappIntl]?.sessionsCompleted)
  const totalSessions = withSessions.reduce((sum, r) => sum + (coaching[r.whatsappIntl]?.sessionsCompleted ?? 0), 0)
  const improvements = withSessions.map(r => coaching[r.whatsappIntl]?.improvement).filter((v): v is number => v !== null && v !== undefined)
  const avgImprovement = improvements.length ? Math.round((improvements.reduce((a, b) => a + b, 0) / improvements.length) * 10) / 10 : null

  return (
    <div className="space-y-6">
      {coachingError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-3 text-sm text-amber-400">
          Couldn&apos;t reach the live coaching database right now — try refreshing shortly.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Teachers Coached" value={withSessions.length} sub={`of ${rows.length} staff`} />
        <StatCard label="Sessions Completed" value={totalSessions} />
        <StatCard label="Avg. Improvement" value={avgImprovement !== null ? `${avgImprovement > 0 ? '+' : ''}${avgImprovement}%` : '—'} sub="first vs. latest session" />
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm">Coaching Detail</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Sessions</th>
                <th className="px-4 py-3 font-medium">First Score</th>
                <th className="px-4 py-3 font-medium">Latest Score</th>
                <th className="px-4 py-3 font-medium">Improvement</th>
                <th className="px-6 py-3 font-medium">Last Session</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const c = coaching[r.whatsappIntl]
                if (!c || c.sessionsCompleted === 0) return null
                return (
                  <tr key={r.sno} className="border-b border-gray-800/60 last:border-0">
                    <td className="px-6 py-3 text-gray-200">{r.name}</td>
                    <td className="px-4 py-3 text-gray-300">{c.sessionsCompleted}</td>
                    <td className="px-4 py-3 text-gray-400">{c.firstScore !== null ? `${c.firstScore}%` : '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{c.latestScore !== null ? `${c.latestScore}%` : '—'}</td>
                    <td className="px-4 py-3">
                      {c.improvement !== null ? (
                        <span className={c.improvement > 0 ? 'text-emerald-400 font-medium' : c.improvement < 0 ? 'text-amber-400 font-medium' : 'text-gray-400'}>
                          {c.improvement > 0 ? '+' : ''}{c.improvement}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-3 text-gray-400">{formatDate(c.lastSessionDate)}</td>
                  </tr>
                )
              })}
              {withSessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No completed coaching sessions yet for this scope.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
