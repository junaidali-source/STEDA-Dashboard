import { pool } from '@/lib/db'
import { getPilotSchools, findPilotSchool, getEnrolledTeacherTotal } from '@/lib/balochistan-pilot-schools'
import { PILOT_START, ENROLLMENT_CUTOFF, DROP_OFF_DAYS } from '@/lib/balochistan-pilot-constants'

export { PILOT_START, ENROLLMENT_CUTOFF, ACTIVATION_TARGET_PCT, ACTIVATION_MIN_PCT, LP_WEEKLY_TARGET_PCT, DROP_OFF_DAYS, PILOT_END_ESTIMATE } from '@/lib/balochistan-pilot-constants'

// Shared filter for "considered population" queries aliased as `u`.
// $1 = ENROLLMENT_CUTOFF
const BALOCHISTAN_USER_FILTER = `
  COALESCE(u.is_test_user, false) = false
  AND LOWER(TRIM(u.region)) = 'balochistan'
  AND u.created_at >= $1::date
`

// Same as onboarding-tracker.ts's COACHING_PCT — the AI's existing pedagogical
// rubric score, used as-is under the MOU's "PITE-aligned" label (no rubric
// crosswalk exists yet).
const COACHING_PCT = `COALESCE(cs.analysis_data->'scores'->>'percentage', cs.analysis_data->'scores'->>'overall_percentage')`

export interface ConsideredTeacher {
  id: string
  phone_number: string
  name: string | null
  school_name: string | null
  emis_code: string | null
  registration_completed: boolean
  created_at: string
  last_activity_at: string | null
  coaching_avg_percentage: number | null
  lesson_plans_count: number
  coaching_sessions_count: number
  reading_assessments_count: number
}

// NOTE: users.lesson_plans_count / coaching_sessions_count / coaching_avg_percentage
// are pre-aggregated summary columns that are NOT kept in sync — verified against
// real teachers (2026-08) showing 0 while the base tables had 4 and 6 completed
// lesson plans respectively. Every count here is computed directly from the base
// tables instead; never reintroduce those summary columns for KPI reporting.
export async function getConsideredTeachers(): Promise<ConsideredTeacher[]> {
  const res = await pool.query(
    `SELECT u.id, u.phone_number, u.name, u.school_name, u.emis_code, u.registration_completed,
            u.created_at, u.last_activity_at,
            (SELECT ROUND(AVG((${COACHING_PCT})::numeric), 1)
             FROM coaching_sessions cs
             WHERE cs.user_id = u.id AND cs.status = 'completed' AND (${COACHING_PCT}) IS NOT NULL) AS coaching_avg_percentage,
            (SELECT COUNT(*)::int FROM lesson_plan_requests lpr
             WHERE lpr.user_id = u.id AND lpr.status = 'completed') AS lesson_plans_count,
            (SELECT COUNT(*)::int FROM coaching_sessions cs
             WHERE cs.user_id = u.id AND cs.status = 'completed') AS coaching_sessions_count,
            (SELECT COUNT(*)::int FROM reading_assessments ra
             WHERE ra.user_id = u.id AND ra.status = 'completed') AS reading_assessments_count
     FROM users u
     WHERE ${BALOCHISTAN_USER_FILTER}
     ORDER BY u.created_at ASC`,
    [ENROLLMENT_CUTOFF]
  )
  return res.rows.map((r: Omit<ConsideredTeacher, 'coaching_avg_percentage'> & { coaching_avg_percentage: string | null }) => ({
    ...r,
    coaching_avg_percentage: r.coaching_avg_percentage !== null ? Number(r.coaching_avg_percentage) : null,
  }))
}

export interface OnboardingBaseline {
  totalConsidered: number
  registrationCompleted: number
  onboardingCompletionPct: number
}

export async function getOnboardingBaseline(): Promise<OnboardingBaseline> {
  const res = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE u.registration_completed)::int AS completed
     FROM users u
     WHERE ${BALOCHISTAN_USER_FILTER}`,
    [ENROLLMENT_CUTOFF]
  )
  const total = res.rows[0]?.total ?? 0
  const completed = res.rows[0]?.completed ?? 0
  return {
    totalConsidered: total,
    registrationCompleted: completed,
    onboardingCompletionPct: total > 0 ? Math.round((completed / total) * 100) : 0,
  }
}

export interface TrueActivation {
  matchedRegistered: number
  enrolledKnownTotal: number
  schoolsWithKnownCount: number
  schoolsWithUnknownCount: number
  isPartial: boolean
  activationPct: number | null
}

// The real "% of enrolled teachers who registered" the MOU asks for — DEO
// nominated headcount as the denominator, matched-and-registered teachers as
// the numerator. Only 8 of 20 schools (Zhob) reported a headcount, so this is
// a floor, not the true rate, until Quetta's counts arrive.
export async function getTrueActivation(): Promise<TrueActivation> {
  const considered = await getConsideredTeachers()
  const enrolled = getEnrolledTeacherTotal()
  let matchedRegistered = 0
  for (const t of considered) {
    if (!t.registration_completed) continue
    if (findPilotSchool(t.emis_code, t.school_name)) matchedRegistered++
  }
  return {
    matchedRegistered,
    enrolledKnownTotal: enrolled.knownTotal,
    schoolsWithKnownCount: enrolled.schoolsWithKnownCount,
    schoolsWithUnknownCount: enrolled.schoolsWithUnknownCount,
    isPartial: !enrolled.isComplete,
    activationPct: enrolled.knownTotal > 0 ? Math.round((matchedRegistered / enrolled.knownTotal) * 100) : null,
  }
}

export interface ActivationWeek {
  week: string
  signups: number
  registered: number
  cumulativeSignups: number
  cumulativeRegistered: number
  activationPct: number
}

// Weekly + cumulative activation trend. Denominator is today's "considered"
// population (self-reported + June cutoff) — swap in the reference list's
// true enrolled-per-school total once available (see plan §1).
export async function getActivationTrend(): Promise<ActivationWeek[]> {
  const res = await pool.query(
    `SELECT date_trunc('week', u.created_at)::date AS week,
            COUNT(*)::int AS signups,
            COUNT(*) FILTER (WHERE u.registration_completed)::int AS registered
     FROM users u
     WHERE ${BALOCHISTAN_USER_FILTER}
     GROUP BY 1 ORDER BY 1`,
    [ENROLLMENT_CUTOFF]
  )
  let cumSignups = 0, cumRegistered = 0
  return res.rows.map((r: { week: string; signups: number; registered: number }) => {
    cumSignups += r.signups
    cumRegistered += r.registered
    return {
      week: new Date(r.week).toISOString().slice(0, 10),
      signups: r.signups,
      registered: r.registered,
      cumulativeSignups: cumSignups,
      cumulativeRegistered: cumRegistered,
      activationPct: cumSignups > 0 ? Math.round((cumRegistered / cumSignups) * 100) : 0,
    }
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
export async function getEngagementTrend(): Promise<EngagementWeek[]> {
  const activeRes = await pool.query(
    `SELECT week, COUNT(DISTINCT user_id)::int AS active_teachers FROM (
       SELECT date_trunc('week', c.created_at)::date AS week, c.user_id
       FROM conversations c JOIN users u ON u.id = c.user_id WHERE ${BALOCHISTAN_USER_FILTER}
       UNION ALL
       SELECT date_trunc('week', lpr.created_at)::date, lpr.user_id
       FROM lesson_plan_requests lpr JOIN users u ON u.id = lpr.user_id WHERE ${BALOCHISTAN_USER_FILTER}
       UNION ALL
       SELECT date_trunc('week', cs.created_at)::date, cs.user_id
       FROM coaching_sessions cs JOIN users u ON u.id = cs.user_id WHERE ${BALOCHISTAN_USER_FILTER}
       UNION ALL
       SELECT date_trunc('week', ra.created_at)::date, ra.user_id
       FROM reading_assessments ra JOIN users u ON u.id = ra.user_id WHERE ${BALOCHISTAN_USER_FILTER}
     ) sub
     GROUP BY week ORDER BY week`,
    [ENROLLMENT_CUTOFF]
  )

  const lpRes = await pool.query(
    `SELECT date_trunc('week', lpr.created_at)::date AS week,
            COUNT(DISTINCT lpr.user_id)::int AS teachers_with_lp
     FROM lesson_plan_requests lpr JOIN users u ON u.id = lpr.user_id
     WHERE ${BALOCHISTAN_USER_FILTER} AND lpr.status = 'completed'
     GROUP BY 1 ORDER BY 1`,
    [ENROLLMENT_CUTOFF]
  )

  const coachRes = await pool.query(
    `SELECT date_trunc('week', cs.created_at)::date AS week,
            COUNT(*)::int AS attempted,
            COUNT(DISTINCT cs.user_id)::int AS teachers
     FROM coaching_sessions cs JOIN users u ON u.id = cs.user_id
     WHERE ${BALOCHISTAN_USER_FILTER}
     GROUP BY 1 ORDER BY 1`,
    [ENROLLMENT_CUTOFF]
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

export async function getCoachingScoreTrend(): Promise<CoachingScoreWeek[]> {
  const res = await pool.query(
    `SELECT date_trunc('week', cs.created_at)::date AS week,
            ROUND(AVG((${COACHING_PCT})::numeric) FILTER (WHERE ${COACHING_PCT} IS NOT NULL), 1) AS avg_score,
            COUNT(*) FILTER (WHERE ${COACHING_PCT} IS NOT NULL)::int AS scored_sessions
     FROM coaching_sessions cs JOIN users u ON u.id = cs.user_id
     WHERE ${BALOCHISTAN_USER_FILTER} AND cs.status = 'completed'
     GROUP BY 1 ORDER BY 1`,
    [ENROLLMENT_CUTOFF]
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
export async function getRetentionSummary(): Promise<RetentionSummary> {
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
     WHERE ${BALOCHISTAN_USER_FILTER}
     GROUP BY u.id`,
    [ENROLLMENT_CUTOFF, PILOT_START]
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
  id: string
  name: string | null
  phoneNumber: string
  schoolName: string | null
  lastActivityAt: string | null
  daysSinceActive: number | null
}

// Surfaces WHO dropped off and WHEN — the doc explicitly asks for the
// quantitative surface only ("to support the qualitative review"), so pattern
// interpretation is left to the human review, not computed here.
export async function getDropOffTeachers(): Promise<DropOffTeacher[]> {
  const res = await pool.query(
    `SELECT u.id, u.name, u.phone_number, u.school_name, u.last_activity_at,
            CASE WHEN u.last_activity_at IS NULL THEN NULL
                 ELSE (CURRENT_DATE - u.last_activity_at::date) END AS days_since_active
     FROM users u
     WHERE ${BALOCHISTAN_USER_FILTER}
       AND (u.last_activity_at IS NULL OR u.last_activity_at::date <= CURRENT_DATE - ${DROP_OFF_DAYS})
     ORDER BY u.last_activity_at ASC NULLS FIRST`,
    [ENROLLMENT_CUTOFF]
  )
  return res.rows.map((r: { id: string; name: string | null; phone_number: string; school_name: string | null; last_activity_at: string | null; days_since_active: number | null }) => ({
    id: r.id, name: r.name, phoneNumber: r.phone_number, schoolName: r.school_name,
    lastActivityAt: r.last_activity_at, daysSinceActive: r.days_since_active,
  }))
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
export async function getReliabilityTrend(): Promise<ReliabilityMonth[]> {
  const res = await pool.query(
    `SELECT date_trunc('month', cs.created_at)::date AS month,
            COUNT(*)::int AS attempted,
            COUNT(*) FILTER (WHERE cs.audio_url IS NOT NULL)::int AS audio_uploaded,
            COUNT(*) FILTER (WHERE cs.status = 'completed')::int AS ai_completed
     FROM coaching_sessions cs JOIN users u ON u.id = cs.user_id
     WHERE ${BALOCHISTAN_USER_FILTER}
     GROUP BY 1 ORDER BY 1`,
    [ENROLLMENT_CUTOFF]
  )
  return res.rows.map((r: { month: string; attempted: number; audio_uploaded: number; ai_completed: number }) => ({
    month: new Date(r.month).toISOString().slice(0, 10),
    attempted: r.attempted,
    audioUploadSuccessPct: r.attempted > 0 ? Math.round((r.audio_uploaded / r.attempted) * 100) : 0,
    aiResponseSuccessPct: r.audio_uploaded > 0 ? Math.round((r.ai_completed / r.audio_uploaded) * 100) : 0,
  }))
}

export interface TeacherRow {
  id: string
  name: string | null
  phoneNumber: string
  schoolName: string | null
  district: string | null
  cohort: string | null
  onboardingStatus: 'registered' | 'pending'
  lessonPlansCount: number
  coachingSessionsCount: number
  coachingAvgPercentage: number | null
  lastActivityAt: string | null
}

export async function getTeacherRows(): Promise<TeacherRow[]> {
  const considered = await getConsideredTeachers()
  return considered.map(t => {
    const school = findPilotSchool(t.emis_code, t.school_name)
    return {
      id: t.id,
      name: t.name,
      phoneNumber: t.phone_number,
      schoolName: school?.schoolName ?? t.school_name,
      district: school?.district ?? null,
      cohort: school?.cohort ?? null,
      onboardingStatus: t.registration_completed ? 'registered' : 'pending',
      lessonPlansCount: t.lesson_plans_count,
      coachingSessionsCount: t.coaching_sessions_count,
      coachingAvgPercentage: t.coaching_avg_percentage,
      lastActivityAt: t.last_activity_at,
    }
  })
}

export interface SchoolCohortRollup {
  district: string
  cohort: string
  schoolName: string
  teacherCount: number
  registeredCount: number
  lessonPlansTotal: number
  coachingSessionsTotal: number
}

export interface SchoolCohortResult {
  available: boolean
  rollups: SchoolCohortRollup[]
  unmatchedTeachers: number
}

// Returns `available: false` (not empty rollups) until the schools reference
// list exists — an empty dashboard section would misleadingly read as
// "zero activity" rather than "no reference data yet".
export async function getSchoolCohortRollups(): Promise<SchoolCohortResult> {
  const schools = getPilotSchools()
  if (schools.length === 0) {
    return { available: false, rollups: [], unmatchedTeachers: 0 }
  }

  const considered = await getConsideredTeachers()
  const groups = new Map<string, SchoolCohortRollup>()
  let unmatched = 0

  for (const t of considered) {
    const school = findPilotSchool(t.emis_code, t.school_name)
    if (!school) { unmatched++; continue }
    const key = `${school.district}|${school.cohort}|${school.schoolName}`
    const row = groups.get(key) ?? {
      district: school.district, cohort: school.cohort, schoolName: school.schoolName,
      teacherCount: 0, registeredCount: 0, lessonPlansTotal: 0, coachingSessionsTotal: 0,
    }
    row.teacherCount++
    if (t.registration_completed) row.registeredCount++
    row.lessonPlansTotal += t.lesson_plans_count
    row.coachingSessionsTotal += t.coaching_sessions_count
    groups.set(key, row)
  }

  return { available: true, rollups: Array.from(groups.values()), unmatchedTeachers: unmatched }
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
export async function getNpsSummary(): Promise<NpsSummary> {
  const empty: NpsSummary = { available: false, totalResponses: 0, promoters: 0, passives: 0, detractors: 0, npsScore: null }
  try {
    const res = await pool.query(
      `SELECT r.score::int AS score
       FROM nps_responses r
       JOIN users u ON u.phone_number = r.phone_number
       WHERE ${BALOCHISTAN_USER_FILTER}`,
      [ENROLLMENT_CUTOFF]
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
