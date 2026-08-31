import { pool } from '@/lib/db'
import { findPilotSchool } from '@/lib/balochistan-pilot-schools'
import { getTeacherRoster, getPhonesFor, filterRoster, type RosterFilters, type RosterTeacher } from '@/lib/balochistan-teacher-roster'
import { PILOT_START, DROP_OFF_DAYS } from '@/lib/balochistan-pilot-constants'

export { PILOT_START, ENROLLMENT_CUTOFF, ACTIVATION_TARGET_PCT, ACTIVATION_MIN_PCT, LP_WEEKLY_TARGET_PCT, DROP_OFF_DAYS, PILOT_END_ESTIMATE } from '@/lib/balochistan-pilot-constants'
export type { RosterFilters } from '@/lib/balochistan-teacher-roster'

// The real DEO-confirmed teacher roster (169 named teachers, phone-verified
// against live Rumi data Aug 2026) is the source of truth for "enrolled" —
// not self-reported region/date, which only ever matched ~7% of it. $1 = the
// (possibly filtered) roster's phone numbers.
const ROSTER_USER_FILTER = `COALESCE(u.is_test_user, false) = false AND u.phone_number = ANY($1::text[])`

// Same as onboarding-tracker.ts's COACHING_PCT — the AI's existing pedagogical
// rubric score, used as-is under the MOU's "PITE-aligned" label (no rubric
// crosswalk exists yet).
const COACHING_PCT = `COALESCE(cs.analysis_data->'scores'->>'percentage', cs.analysis_data->'scores'->>'overall_percentage')`

function scopedRoster(filters?: RosterFilters): RosterTeacher[] {
  const roster = getTeacherRoster()
  return filters ? filterRoster(roster, filters) : roster
}

// Shared by every API route so `?district=&school=&gender=&q=` is parsed
// identically everywhere.
export function filtersFromSearchParams(sp: URLSearchParams): RosterFilters {
  return {
    district: sp.get('district') || undefined,
    school: sp.get('school') || undefined,
    gender: sp.get('gender') || undefined,
    q: sp.get('q') || undefined,
  }
}

export interface RosterLiveStatus {
  id: string | null
  registrationCompleted: boolean
  registeredAt: string | null
  lastActivityAt: string | null
  lessonPlansCount: number
  coachingSessionsCount: number
  coachingAvgPercentage: number | null
  readingAssessmentsCount: number
}

// Live status per given phone number. users.lesson_plans_count /
// coaching_sessions_count / coaching_avg_percentage are pre-aggregated
// summary columns that are NOT kept in sync — verified against real pilot
// teachers (2026-08) showing 0 while the base tables had 4 and 6 completed
// lesson plans respectively. Every count here is computed directly from the
// base tables instead; never reintroduce those summary columns for KPIs.
async function getRosterLiveStatus(phones: string[]): Promise<Map<string, RosterLiveStatus>> {
  const map = new Map<string, RosterLiveStatus>()
  if (phones.length === 0) return map

  const res = await pool.query(
    `SELECT u.phone_number, u.id, u.registration_completed,
            COALESCE(u.registration_completed_at, u.created_at) AS registered_at,
            u.last_activity_at,
            (SELECT COUNT(*)::int FROM lesson_plan_requests lpr
             WHERE lpr.user_id = u.id AND lpr.status = 'completed') AS lesson_plans_count,
            (SELECT COUNT(*)::int FROM coaching_sessions cs
             WHERE cs.user_id = u.id AND cs.status = 'completed') AS coaching_sessions_count,
            (SELECT ROUND(AVG((${COACHING_PCT})::numeric), 1)
             FROM coaching_sessions cs
             WHERE cs.user_id = u.id AND cs.status = 'completed' AND (${COACHING_PCT}) IS NOT NULL) AS coaching_avg_percentage,
            (SELECT COUNT(*)::int FROM reading_assessments ra
             WHERE ra.user_id = u.id AND ra.status = 'completed') AS reading_assessments_count
     FROM users u
     WHERE ${ROSTER_USER_FILTER}`,
    [phones]
  )
  for (const row of res.rows as {
    phone_number: string; id: string; registration_completed: boolean; registered_at: string | null
    last_activity_at: string | null; lesson_plans_count: number; coaching_sessions_count: number
    coaching_avg_percentage: string | null; reading_assessments_count: number
  }[]) {
    map.set(row.phone_number, {
      id: row.id,
      registrationCompleted: row.registration_completed,
      registeredAt: row.registered_at,
      lastActivityAt: row.last_activity_at,
      lessonPlansCount: row.lesson_plans_count,
      coachingSessionsCount: row.coaching_sessions_count,
      coachingAvgPercentage: row.coaching_avg_percentage !== null ? Number(row.coaching_avg_percentage) : null,
      readingAssessmentsCount: row.reading_assessments_count,
    })
  }
  return map
}

// Registered = registration_completed. Activated = registered AND has
// actually used at least one core feature (lesson plan, coaching, or
// reading assessment) — the MOU's "register AND start using" definition,
// distinct from mere registration (surfaced explicitly after SED's 25 Aug
// 2026 roster pull reported these as two different numbers: 58% registered
// vs 33% activated).
function isActivated(status: RosterLiveStatus | undefined): boolean {
  if (!status?.registrationCompleted) return false
  return status.lessonPlansCount > 0 || status.coachingSessionsCount > 0 || status.readingAssessmentsCount > 0
}

export interface OnboardingBaseline {
  totalEnrolled: number
  registrationCompleted: number
  onboardingCompletionPct: number
  activated: number
  activationPct: number
}

export async function getOnboardingBaseline(filters?: RosterFilters): Promise<OnboardingBaseline> {
  const roster = scopedRoster(filters)
  const live = await getRosterLiveStatus(getPhonesFor(roster))
  const registered = roster.filter(t => t.phone && live.get(t.phone)?.registrationCompleted).length
  const activated = roster.filter(t => isActivated(t.phone ? live.get(t.phone) : undefined)).length
  return {
    totalEnrolled: roster.length,
    registrationCompleted: registered,
    onboardingCompletionPct: roster.length > 0 ? Math.round((registered / roster.length) * 100) : 0,
    activated,
    activationPct: roster.length > 0 ? Math.round((activated / roster.length) * 100) : 0,
  }
}

export interface ActivationWeek {
  week: string
  newlyRegistered: number
  cumulativeRegistered: number
  registrationPct: number
  newlyActivated: number
  cumulativeActivated: number
  activationPct: number
}

// Two independent cumulative trends against the fixed roster size:
// registrationPct = "% of enrolled who registered" (registration_completed),
// activationPct = "% of enrolled who registered AND actually used a core
// feature" — the MOU's real activation definition. Kept as two lines on one
// trend so the gap between them (registered-but-inactive teachers) is
// visible, matching the split SED's 25 Aug 2026 roster pull reported.
export async function getActivationTrend(filters?: RosterFilters): Promise<ActivationWeek[]> {
  const roster = scopedRoster(filters)
  const phones = getPhonesFor(roster)
  const total = roster.length
  if (phones.length === 0 || total === 0) return []

  const [registeredRes, activatedRes] = await Promise.all([
    pool.query(
      `SELECT date_trunc('week', COALESCE(u.registration_completed_at, u.created_at))::date AS week,
              COUNT(*)::int AS newly_registered
       FROM users u
       WHERE ${ROSTER_USER_FILTER} AND u.registration_completed
       GROUP BY 1 ORDER BY 1`,
      [phones]
    ),
    pool.query(
      `WITH first_activity AS (
         SELECT user_id, MIN(created_at) AS first_at FROM (
           SELECT user_id, created_at FROM lesson_plan_requests
           UNION ALL SELECT user_id, created_at FROM coaching_sessions
           UNION ALL SELECT user_id, created_at FROM reading_assessments
         ) x GROUP BY user_id
       )
       SELECT date_trunc('week', fa.first_at)::date AS week, COUNT(*)::int AS newly_activated
       FROM users u
       JOIN first_activity fa ON fa.user_id = u.id
       WHERE ${ROSTER_USER_FILTER} AND u.registration_completed
       GROUP BY 1 ORDER BY 1`,
      [phones]
    ),
  ])

  const weekKey = (d: string) => new Date(d).toISOString().slice(0, 10)
  const byWeek = new Map<string, ActivationWeek>()
  for (const r of registeredRes.rows as { week: string; newly_registered: number }[]) {
    const k = weekKey(r.week)
    byWeek.set(k, { week: k, newlyRegistered: r.newly_registered, cumulativeRegistered: 0, registrationPct: 0, newlyActivated: 0, cumulativeActivated: 0, activationPct: 0 })
  }
  for (const r of activatedRes.rows as { week: string; newly_activated: number }[]) {
    const k = weekKey(r.week)
    const row = byWeek.get(k) ?? { week: k, newlyRegistered: 0, cumulativeRegistered: 0, registrationPct: 0, newlyActivated: 0, cumulativeActivated: 0, activationPct: 0 }
    row.newlyActivated = r.newly_activated
    byWeek.set(k, row)
  }

  let cumReg = 0, cumAct = 0
  return Array.from(byWeek.values())
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(row => {
      cumReg += row.newlyRegistered
      cumAct += row.newlyActivated
      return { ...row, cumulativeRegistered: cumReg, registrationPct: Math.round((cumReg / total) * 100), cumulativeActivated: cumAct, activationPct: Math.round((cumAct / total) * 100) }
    })
}

export interface EngagementWeek {
  week: string
  activeTeachers: number
  teachersWithLp: number
  lpWeeklyPct: number
  coachingAttempted: number
  coachingTeachers: number
}

// "Active this week" = any signal at all (conversation or any feature),
// so the 75%-of-active-teachers LP target has a real denominator.
export async function getEngagementTrend(filters?: RosterFilters): Promise<EngagementWeek[]> {
  const phones = getPhonesFor(scopedRoster(filters))
  if (phones.length === 0) return []

  const activeRes = await pool.query(
    `SELECT week, COUNT(DISTINCT user_id)::int AS active_teachers FROM (
       SELECT date_trunc('week', c.created_at)::date AS week, c.user_id
       FROM conversations c JOIN users u ON u.id = c.user_id WHERE ${ROSTER_USER_FILTER}
       UNION ALL
       SELECT date_trunc('week', lpr.created_at)::date, lpr.user_id
       FROM lesson_plan_requests lpr JOIN users u ON u.id = lpr.user_id WHERE ${ROSTER_USER_FILTER}
       UNION ALL
       SELECT date_trunc('week', cs.created_at)::date, cs.user_id
       FROM coaching_sessions cs JOIN users u ON u.id = cs.user_id WHERE ${ROSTER_USER_FILTER}
       UNION ALL
       SELECT date_trunc('week', ra.created_at)::date, ra.user_id
       FROM reading_assessments ra JOIN users u ON u.id = ra.user_id WHERE ${ROSTER_USER_FILTER}
     ) sub
     GROUP BY week ORDER BY week`,
    [phones]
  )

  const lpRes = await pool.query(
    `SELECT date_trunc('week', lpr.created_at)::date AS week,
            COUNT(DISTINCT lpr.user_id)::int AS teachers_with_lp
     FROM lesson_plan_requests lpr JOIN users u ON u.id = lpr.user_id
     WHERE ${ROSTER_USER_FILTER} AND lpr.status = 'completed'
     GROUP BY 1 ORDER BY 1`,
    [phones]
  )

  const coachRes = await pool.query(
    `SELECT date_trunc('week', cs.created_at)::date AS week,
            COUNT(*)::int AS attempted,
            COUNT(DISTINCT cs.user_id)::int AS teachers
     FROM coaching_sessions cs JOIN users u ON u.id = cs.user_id
     WHERE ${ROSTER_USER_FILTER}
     GROUP BY 1 ORDER BY 1`,
    [phones]
  )

  const byWeek = new Map<string, EngagementWeek>()
  const weekKey = (d: string) => new Date(d).toISOString().slice(0, 10)
  for (const r of activeRes.rows as { week: string; active_teachers: number }[]) {
    byWeek.set(weekKey(r.week), { week: weekKey(r.week), activeTeachers: r.active_teachers, teachersWithLp: 0, lpWeeklyPct: 0, coachingAttempted: 0, coachingTeachers: 0 })
  }
  for (const r of lpRes.rows as { week: string; teachers_with_lp: number }[]) {
    const k = weekKey(r.week)
    const row = byWeek.get(k) ?? { week: k, activeTeachers: 0, teachersWithLp: 0, lpWeeklyPct: 0, coachingAttempted: 0, coachingTeachers: 0 }
    row.teachersWithLp = r.teachers_with_lp
    byWeek.set(k, row)
  }
  for (const r of coachRes.rows as { week: string; attempted: number; teachers: number }[]) {
    const k = weekKey(r.week)
    const row = byWeek.get(k) ?? { week: k, activeTeachers: 0, teachersWithLp: 0, lpWeeklyPct: 0, coachingAttempted: 0, coachingTeachers: 0 }
    row.coachingAttempted = r.attempted
    row.coachingTeachers = r.teachers
    byWeek.set(k, row)
  }
  return Array.from(byWeek.values())
    .map(row => ({ ...row, lpWeeklyPct: row.activeTeachers > 0 ? Math.round((row.teachersWithLp / row.activeTeachers) * 100) : 0 }))
    .sort((a, b) => a.week.localeCompare(b.week))
}

export interface CoachingScoreWeek {
  week: string
  avgScore: number | null
  scoredSessions: number
}

export async function getCoachingScoreTrend(filters?: RosterFilters): Promise<CoachingScoreWeek[]> {
  const phones = getPhonesFor(scopedRoster(filters))
  if (phones.length === 0) return []

  const res = await pool.query(
    `SELECT date_trunc('week', cs.created_at)::date AS week,
            ROUND(AVG((${COACHING_PCT})::numeric) FILTER (WHERE ${COACHING_PCT} IS NOT NULL), 1) AS avg_score,
            COUNT(*) FILTER (WHERE ${COACHING_PCT} IS NOT NULL)::int AS scored_sessions
     FROM coaching_sessions cs JOIN users u ON u.id = cs.user_id
     WHERE ${ROSTER_USER_FILTER} AND cs.status = 'completed'
     GROUP BY 1 ORDER BY 1`,
    [phones]
  )
  return res.rows.map((r: { week: string; avg_score: string | null; scored_sessions: number }) => ({
    week: new Date(r.week).toISOString().slice(0, 10),
    avgScore: r.avg_score !== null ? Number(r.avg_score) : null,
    scoredSessions: r.scored_sessions,
  }))
}

export interface RetentionSummary {
  activeMonth1: number
  activeBothMonths: number
  retentionPct: number
}

// Month 1 / Month 2 are pilot-relative 30-day windows from PILOT_START, not
// calendar months (the MOU's reporting period has its own start date).
export async function getRetentionSummary(filters?: RosterFilters): Promise<RetentionSummary> {
  const phones = getPhonesFor(scopedRoster(filters))
  if (phones.length === 0) return { activeMonth1: 0, activeBothMonths: 0, retentionPct: 0 }

  const res = await pool.query(
    `WITH activity AS (
       SELECT user_id, created_at FROM conversations
       UNION ALL SELECT user_id, created_at FROM lesson_plan_requests
       UNION ALL SELECT user_id, created_at FROM coaching_sessions
       UNION ALL SELECT user_id, created_at FROM reading_assessments
       UNION ALL SELECT user_id, created_at FROM video_requests
       UNION ALL SELECT user_id, created_at FROM image_analysis_requests
     )
     SELECT
       BOOL_OR(a.created_at >= $2::date AND a.created_at < $2::date + INTERVAL '30 days') AS active_month1,
       BOOL_OR(a.created_at >= $2::date + INTERVAL '30 days' AND a.created_at < $2::date + INTERVAL '60 days') AS active_month2
     FROM users u
     LEFT JOIN activity a ON a.user_id = u.id
     WHERE ${ROSTER_USER_FILTER}
     GROUP BY u.id`,
    [phones, PILOT_START]
  )
  const rows = res.rows as { active_month1: boolean; active_month2: boolean }[]
  const activeMonth1 = rows.filter(r => r.active_month1).length
  const activeBothMonths = rows.filter(r => r.active_month1 && r.active_month2).length
  return {
    activeMonth1,
    activeBothMonths,
    retentionPct: activeMonth1 > 0 ? Math.round((activeBothMonths / activeMonth1) * 100) : 0,
  }
}

export interface DropOffTeacher {
  name: string
  phoneNumber: string
  schoolName: string
  lastActivityAt: string | null
  daysSinceActive: number | null
}

// Surfaces WHO dropped off and WHEN, across the (possibly filtered) roster
// (registered or not) — the doc explicitly asks for the quantitative surface
// only ("to support the qualitative review"), so pattern interpretation is
// left to the human review, not computed here.
export async function getDropOffTeachers(filters?: RosterFilters): Promise<DropOffTeacher[]> {
  const roster = scopedRoster(filters)
  const live = await getRosterLiveStatus(getPhonesFor(roster))
  const now = Date.now()

  return roster
    .map(t => {
      const status = t.phone ? live.get(t.phone) : undefined
      const lastActivityAt = status?.lastActivityAt ?? null
      const daysSinceActive = lastActivityAt ? Math.floor((now - new Date(lastActivityAt).getTime()) / 86400000) : null
      return { name: t.name, phoneNumber: t.phone ?? '', schoolName: t.schoolName, lastActivityAt, daysSinceActive }
    })
    .filter(t => t.daysSinceActive === null || t.daysSinceActive >= DROP_OFF_DAYS)
    .sort((a, b) => (a.lastActivityAt ?? '').localeCompare(b.lastActivityAt ?? ''))
}

export interface ReliabilityMonth {
  month: string
  attempted: number
  audioUploadSuccessPct: number
  aiResponseSuccessPct: number
}

// Audio upload success = session has an audio_url at all (out of everything
// attempted). AI response success = of those that uploaded, how many reached
// a completed analysis. `failed_step`/`error_message` exist for deeper
// pipeline diagnostics but exact step-name values need live verification
// before building a more granular breakdown.
export async function getReliabilityTrend(filters?: RosterFilters): Promise<ReliabilityMonth[]> {
  const phones = getPhonesFor(scopedRoster(filters))
  if (phones.length === 0) return []

  const res = await pool.query(
    `SELECT date_trunc('month', cs.created_at)::date AS month,
            COUNT(*)::int AS attempted,
            COUNT(*) FILTER (WHERE cs.audio_url IS NOT NULL)::int AS audio_uploaded,
            COUNT(*) FILTER (WHERE cs.status = 'completed')::int AS ai_completed
     FROM coaching_sessions cs JOIN users u ON u.id = cs.user_id
     WHERE ${ROSTER_USER_FILTER}
     GROUP BY 1 ORDER BY 1`,
    [phones]
  )
  return res.rows.map((r: { month: string; attempted: number; audio_uploaded: number; ai_completed: number }) => ({
    month: new Date(r.month).toISOString().slice(0, 10),
    attempted: r.attempted,
    audioUploadSuccessPct: r.attempted > 0 ? Math.round((r.audio_uploaded / r.attempted) * 100) : 0,
    aiResponseSuccessPct: r.audio_uploaded > 0 ? Math.round((r.ai_completed / r.audio_uploaded) * 100) : 0,
  }))
}

export interface TeacherRow {
  name: string
  phoneNumber: string
  schoolName: string
  district: string
  cohort: string | null
  gender: string
  onboardingStatus: 'registered' | 'pending'
  lessonPlansCount: number
  coachingSessionsCount: number
  coachingAvgPercentage: number | null
  lastActivityAt: string | null
  notes: string
  hasPhoneConflict: boolean
}

// Every matching roster teacher, registered or not — same shape as the STEDA
// onboarding tracker's live-join pattern. `hasPhoneConflict` flags roster
// rows sharing a phone number with another row ANYWHERE in the full roster
// (a real, unresolved data issue in the source file — e.g. Muhammad Hassan /
// Abdul Mateen), computed against the full roster so filtering never hides a
// conflict that involves a teacher currently filtered out.
export async function getTeacherRows(filters?: RosterFilters): Promise<TeacherRow[]> {
  const fullRoster = getTeacherRoster()
  const phoneCounts = new Map<string, number>()
  for (const t of fullRoster) if (t.phone) phoneCounts.set(t.phone, (phoneCounts.get(t.phone) ?? 0) + 1)

  const roster = filters ? filterRoster(fullRoster, filters) : fullRoster
  const live = await getRosterLiveStatus(getPhonesFor(roster))

  return roster.map(t => {
    const status = t.phone ? live.get(t.phone) : undefined
    const school = findPilotSchool(t.emisCode, t.schoolName)
    return {
      name: t.name,
      phoneNumber: t.phone ?? '',
      schoolName: t.schoolName,
      district: t.district,
      cohort: school?.cohort || null,
      gender: t.gender,
      onboardingStatus: status?.registrationCompleted ? 'registered' : 'pending',
      lessonPlansCount: status?.lessonPlansCount ?? 0,
      coachingSessionsCount: status?.coachingSessionsCount ?? 0,
      coachingAvgPercentage: status?.coachingAvgPercentage ?? null,
      lastActivityAt: status?.lastActivityAt ?? null,
      notes: t.notes,
      hasPhoneConflict: !!t.phone && (phoneCounts.get(t.phone) ?? 0) > 1,
    }
  })
}

export interface SchoolCohortRollup {
  district: string
  cohort: string
  schoolName: string
  emisCode: string
  teacherCount: number
  registeredCount: number
  lessonPlansTotal: number
  coachingSessionsTotal: number
}

export interface SchoolCohortResult {
  available: boolean
  rollups: SchoolCohortRollup[]
}

// Grouped directly from the verified roster now — no more EMIS/name fuzzy
// matching against self-reported user fields. Cohort/head-teacher enrichment
// still comes from the schools reference file (Balochistan_Pilot_Schools.csv)
// where available.
export async function getSchoolCohortRollups(filters?: RosterFilters): Promise<SchoolCohortResult> {
  const roster = scopedRoster(filters)
  if (getTeacherRoster().length === 0) return { available: false, rollups: [] }

  const live = await getRosterLiveStatus(getPhonesFor(roster))
  const groups = new Map<string, SchoolCohortRollup>()

  for (const t of roster) {
    const school = findPilotSchool(t.emisCode, t.schoolName)
    const key = `${t.district}|${t.emisCode}|${t.schoolName}`
    const row = groups.get(key) ?? {
      district: t.district, cohort: school?.cohort || '', schoolName: t.schoolName, emisCode: t.emisCode,
      teacherCount: 0, registeredCount: 0, lessonPlansTotal: 0, coachingSessionsTotal: 0,
    }
    const status = t.phone ? live.get(t.phone) : undefined
    row.teacherCount++
    if (status?.registrationCompleted) row.registeredCount++
    row.lessonPlansTotal += status?.lessonPlansCount ?? 0
    row.coachingSessionsTotal += status?.coachingSessionsCount ?? 0
    groups.set(key, row)
  }

  return { available: true, rollups: Array.from(groups.values()) }
}

export interface NpsSummary {
  available: boolean
  totalResponses: number
  promoters: number
  passives: number
  detractors: number
  npsScore: number | null
}

// Reads from `nps_responses(phone_number, score, submitted_at)` — a table
// that does not exist yet. Two external dependencies block this actually
// having data: (1) a DB migration to create the table, owned by whoever
// manages the Postgres schema; (2) the Rumi WhatsApp bot itself asking the
// NPS question and writing the response — that's a different codebase from
// this dashboard, not something buildable here. This function is wired up
// and ready to read real rows the moment both exist; until then it detects
// the missing-table error (Postgres 42P01) and reports `available: false`
// rather than crashing.
export async function getNpsSummary(filters?: RosterFilters): Promise<NpsSummary> {
  const empty: NpsSummary = { available: false, totalResponses: 0, promoters: 0, passives: 0, detractors: 0, npsScore: null }
  const phones = getPhonesFor(scopedRoster(filters))
  if (phones.length === 0) return empty
  try {
    const res = await pool.query(
      `SELECT r.score::int AS score
       FROM nps_responses r
       JOIN users u ON u.phone_number = r.phone_number
       WHERE ${ROSTER_USER_FILTER}`,
      [phones]
    )
    const scores = res.rows.map((r: { score: number }) => r.score)
    const total = scores.length
    const promoters = scores.filter(s => s >= 9).length
    const detractors = scores.filter(s => s <= 6).length
    const passives = total - promoters - detractors
    return {
      available: true,
      totalResponses: total,
      promoters, passives, detractors,
      npsScore: total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null,
    }
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === '42P01') return empty
    throw e
  }
}
