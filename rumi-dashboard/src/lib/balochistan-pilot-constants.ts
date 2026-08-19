// Pure constants shared by server query code (balochistan-pilot.ts) and
// client components (balochistan-pilot/page.tsx) — no server-only imports
// (pg, fs) here, so this is safe to bundle into the browser.

// MOU reporting period start (School Education Department, Government of
// Balochistan pilot — 20 schools, District Quetta & District Zhob).
export const PILOT_START = '2026-08-03'

// `users.region` is self-reported and has no district/school/cohort
// granularity — this cutoff is the agreed-upon approximation for "enrolled
// population" for teachers not matched to a nominated school. School
// nominations were finalized 02–10 Jul 2026 (DEO Zhob & Quetta letters).
export const ENROLLMENT_CUTOFF = '2026-07-01'

export const ACTIVATION_TARGET_PCT = 90
export const ACTIVATION_MIN_PCT = 60
export const LP_WEEKLY_TARGET_PCT = 75
export const DROP_OFF_DAYS = 14

// 8 weeks from the earlier of the two DEO nomination letters (Zhob, 2 Jul
// 2026). An ESTIMATE, not a confirmed date — actual pilot kickoff (WhatsApp
// group formation / teacher onboarding) may lag the nomination letter by
// days or weeks. Confirm against real kickoff before using this to gate
// anything (e.g. when to actually send the NPS survey).
export const PILOT_END_ESTIMATE = '2026-08-27'
