import fs from 'fs'
import path from 'path'
import { pool } from '@/lib/db'

export interface OnboardingTeacher {
  sno: number
  name: string
  role: string
  subject: string
  className: string
  whatsappLocal: string
  whatsappIntl: string
  school: string
  emisCode: string
  district: string
  province: string
  status: string
  lpCompletedSnapshot: number
  lpLastDateSnapshot: string
  coachingCompletedSnapshot: number
  coachingLastDateSnapshot: string
}

function normPhone(raw: string): string {
  if (!raw) return ''
  let p = raw.replace(/[\s\-\(\)]/g, '')
  if (!p) return ''
  if (p.startsWith('0'))   return '92' + p.slice(1)
  if (p.startsWith('+92')) return p.slice(1)
  if (p.startsWith('92'))  return p
  return '92' + p
}

// Simple CSV row splitter that handles quoted fields (matches steda-phones.ts pattern)
function splitCSVRow(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

let _cache: OnboardingTeacher[] | null = null

export function getOnboardingRoster(): OnboardingTeacher[] {
  if (_cache) return _cache

  const csvPath = path.join(process.cwd(), 'data', 'Rumi_Onboarding_GGHS_MA_Jinnah_Hyderabad.csv')
  const raw = fs.readFileSync(csvPath, 'utf-8')
  const content = raw.replace(/^﻿/, '')
  const lines = content.split('\n').map(l => l.replace(/\r$/, ''))

  if (lines.length < 2) throw new Error('CSV appears empty')

  const headers = splitCSVRow(lines[0])
  const idx = {
    sno:          headers.indexOf('S.No'),
    name:         headers.indexOf('Name'),
    role:         headers.indexOf('Role'),
    subject:      headers.indexOf('Subject'),
    class:        headers.indexOf('Class'),
    waLocal:      headers.indexOf('WhatsApp (Local)'),
    waIntl:       headers.indexOf('WhatsApp (Intl)'),
    school:       headers.indexOf('School'),
    emis:         headers.indexOf('EMIS Code'),
    district:     headers.indexOf('District'),
    province:     headers.indexOf('Province'),
    status:       headers.indexOf('Onboarding Status'),
    lpCount:      headers.indexOf('LP Completed'),
    lpDate:       headers.indexOf('LP Last Date'),
    coachCount:   headers.indexOf('Coaching Completed'),
    coachDate:    headers.indexOf('Coaching Last Date'),
  }

  const rows: OnboardingTeacher[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = splitCSVRow(line)
    const name = (cols[idx.name] || '').trim()
    if (!name) continue

    rows.push({
      sno:           parseInt(cols[idx.sno], 10) || rows.length + 1,
      name,
      role:          (cols[idx.role]     || '').trim(),
      subject:       (cols[idx.subject]  || '').trim(),
      className:     (cols[idx.class]    || '').trim(),
      whatsappLocal: (cols[idx.waLocal]  || '').trim(),
      whatsappIntl:  normPhone(cols[idx.waIntl] || cols[idx.waLocal] || ''),
      school:        (cols[idx.school]   || '').trim(),
      emisCode:      (cols[idx.emis]     || '').trim(),
      district:      (cols[idx.district] || '').trim(),
      province:      (cols[idx.province] || '').trim(),
      status:        (cols[idx.status]   || 'Pending').trim(),
      lpCompletedSnapshot:      parseInt(cols[idx.lpCount], 10) || 0,
      lpLastDateSnapshot:       (cols[idx.lpDate]    || '').trim(),
      coachingCompletedSnapshot: parseInt(cols[idx.coachCount], 10) || 0,
      coachingLastDateSnapshot:  (cols[idx.coachDate] || '').trim(),
    })
  }

  _cache = rows
  return _cache
}

export type OnboardingScope =
  | { type: 'school'; value: string }
  | { type: 'district'; value: string }
  | null

export function getScopedRoster(scope: OnboardingScope): OnboardingTeacher[] {
  const rows = getOnboardingRoster()
  if (!scope) return rows
  if (scope.type === 'school')   return rows.filter(r => r.school.toLowerCase()   === scope.value.toLowerCase())
  if (scope.type === 'district') return rows.filter(r => r.district.toLowerCase() === scope.value.toLowerCase())
  return rows
}

export type LiveStatus = 'active' | 'joined' | 'pending'

interface LiveStatusInfo {
  joined: boolean
  active: boolean
  lpCompleted: number
  lpLastDate: string | null
  coachingCompleted: number
  coachingLastDate: string | null
  readingCompleted: number
  videoCompleted: number
  imageCompleted: number
}

// Cross-checks each teacher's WhatsApp number against real product usage:
// 'active' = has a Rumi account AND has completed at least one AI feature
// 'joined' = has a Rumi account but hasn't completed a feature yet
// 'pending' = phone number not found in `users` at all
export async function getLiveJoinStatus(phones: string[]): Promise<Record<string, LiveStatusInfo>> {
  const map: Record<string, LiveStatusInfo> = {}
  const uniquePhones = Array.from(new Set(phones.filter(Boolean)))
  if (uniquePhones.length === 0) return map

  const usersRes = await pool.query(
    `SELECT id, phone_number FROM users
     WHERE phone_number = ANY($1::text[]) AND COALESCE(is_test_user, false) = false`,
    [uniquePhones]
  )
  const idToPhone = new Map<string, string>()
  for (const row of usersRes.rows as { id: string; phone_number: string }[]) {
    idToPhone.set(row.id, row.phone_number)
    map[row.phone_number] = {
      joined: true, active: false,
      lpCompleted: 0, lpLastDate: null,
      coachingCompleted: 0, coachingLastDate: null,
      readingCompleted: 0, videoCompleted: 0, imageCompleted: 0,
    }
  }

  const ids = Array.from(idToPhone.keys())
  if (ids.length === 0) return map

  const lpRes = await pool.query(
    `SELECT user_id, COUNT(*)::int AS completed, MAX(created_at) AS last_date
     FROM lesson_plan_requests WHERE user_id = ANY($1::uuid[]) AND status = 'completed'
     GROUP BY user_id`,
    [ids]
  )
  for (const row of lpRes.rows as { user_id: string; completed: number; last_date: string }[]) {
    const phone = idToPhone.get(row.user_id)
    if (!phone) continue
    map[phone].lpCompleted = row.completed
    map[phone].lpLastDate = row.last_date
    if (row.completed > 0) map[phone].active = true
  }

  const coachRes = await pool.query(
    `SELECT user_id, COUNT(*)::int AS completed, MAX(created_at) AS last_date
     FROM coaching_sessions WHERE user_id = ANY($1::uuid[]) AND status = 'completed'
     GROUP BY user_id`,
    [ids]
  )
  for (const row of coachRes.rows as { user_id: string; completed: number; last_date: string }[]) {
    const phone = idToPhone.get(row.user_id)
    if (!phone) continue
    map[phone].coachingCompleted = row.completed
    map[phone].coachingLastDate = row.last_date
    if (row.completed > 0) map[phone].active = true
  }

  const readingRes = await pool.query(
    `SELECT user_id, COUNT(*)::int AS completed
     FROM reading_assessments WHERE user_id = ANY($1::uuid[]) AND status = 'completed'
     GROUP BY user_id`,
    [ids]
  )
  for (const row of readingRes.rows as { user_id: string; completed: number }[]) {
    const phone = idToPhone.get(row.user_id)
    if (!phone) continue
    map[phone].readingCompleted = row.completed
    if (row.completed > 0) map[phone].active = true
  }

  const videoRes = await pool.query(
    `SELECT user_id, COUNT(*)::int AS completed
     FROM video_requests WHERE user_id = ANY($1::uuid[]) AND status = 'completed'
     GROUP BY user_id`,
    [ids]
  )
  for (const row of videoRes.rows as { user_id: string; completed: number }[]) {
    const phone = idToPhone.get(row.user_id)
    if (!phone) continue
    map[phone].videoCompleted = row.completed
    if (row.completed > 0) map[phone].active = true
  }

  const imageRes = await pool.query(
    `SELECT user_id, COUNT(*)::int AS completed
     FROM image_analysis_requests WHERE user_id = ANY($1::uuid[]) AND status = 'completed'
     GROUP BY user_id`,
    [ids]
  )
  for (const row of imageRes.rows as { user_id: string; completed: number }[]) {
    const phone = idToPhone.get(row.user_id)
    if (!phone) continue
    map[phone].imageCompleted = row.completed
    if (row.completed > 0) map[phone].active = true
  }

  return map
}

function normalizeCsvStatus(status: string): LiveStatus {
  const s = status.trim().toLowerCase()
  if (s === 'active') return 'active'
  if (s === 'onboarded' || s === 'joined') return 'joined'
  return 'pending'
}

// `liveUnavailable` means the DB lookup itself failed (not "no match found") —
// in that case fall back to the CSV's last-verified status instead of showing
// every teacher as Pending.
export function resolveLiveStatus(
  row: OnboardingTeacher,
  live: Record<string, LiveStatusInfo>,
  liveUnavailable: boolean
): LiveStatus {
  if (liveUnavailable) return normalizeCsvStatus(row.status)
  const info = live[row.whatsappIntl]
  if (!info) return 'pending'
  return info.active ? 'active' : 'joined'
}

export interface UsageInfo {
  lpCompleted: number
  lpLastDate: string | null
  coachingCompleted: number
  coachingLastDate: string | null
  readingCompleted: number
  videoCompleted: number
  imageCompleted: number
}

export function resolveUsage(
  row: OnboardingTeacher,
  live: Record<string, LiveStatusInfo>,
  liveUnavailable: boolean
): UsageInfo {
  if (liveUnavailable) {
    return {
      lpCompleted: row.lpCompletedSnapshot,
      lpLastDate: row.lpLastDateSnapshot || null,
      coachingCompleted: row.coachingCompletedSnapshot,
      coachingLastDate: row.coachingLastDateSnapshot || null,
      readingCompleted: 0,
      videoCompleted: 0,
      imageCompleted: 0,
    }
  }
  const info = live[row.whatsappIntl]
  if (!info) return { lpCompleted: 0, lpLastDate: null, coachingCompleted: 0, coachingLastDate: null, readingCompleted: 0, videoCompleted: 0, imageCompleted: 0 }
  return {
    lpCompleted: info.lpCompleted,
    lpLastDate: info.lpLastDate,
    coachingCompleted: info.coachingCompleted,
    coachingLastDate: info.coachingLastDate,
    readingCompleted: info.readingCompleted,
    videoCompleted: info.videoCompleted,
    imageCompleted: info.imageCompleted,
  }
}

export interface CoachingDetail {
  sessionsCompleted: number
  firstScore: number | null
  latestScore: number | null
  avgScore: number | null
  improvement: number | null
  lastSessionDate: string | null
}

const COACHING_PCT = `COALESCE(cs.analysis_data->'scores'->>'percentage', cs.analysis_data->'scores'->>'overall_percentage')`

// Per-teacher coaching session history: how many completed, their first vs.
// most recent overall score, and the improvement between them.
export async function getCoachingDetails(phones: string[]): Promise<Record<string, CoachingDetail>> {
  const map: Record<string, CoachingDetail> = {}
  const uniquePhones = Array.from(new Set(phones.filter(Boolean)))
  if (uniquePhones.length === 0) return map

  const usersRes = await pool.query(
    `SELECT id, phone_number FROM users
     WHERE phone_number = ANY($1::text[]) AND COALESCE(is_test_user, false) = false`,
    [uniquePhones]
  )
  const idToPhone = new Map<string, string>()
  for (const row of usersRes.rows as { id: string; phone_number: string }[]) {
    idToPhone.set(row.id, row.phone_number)
  }
  const ids = Array.from(idToPhone.keys())
  if (ids.length === 0) return map

  const res = await pool.query(
    `SELECT
       cs.user_id,
       COUNT(*)::int AS sessions,
       MAX(cs.created_at) AS last_date,
       ROUND(AVG((${COACHING_PCT})::numeric) FILTER (WHERE ${COACHING_PCT} IS NOT NULL), 1) AS avg_score,
       (array_agg((${COACHING_PCT})::numeric ORDER BY cs.created_at ASC)  FILTER (WHERE ${COACHING_PCT} IS NOT NULL))[1] AS first_score,
       (array_agg((${COACHING_PCT})::numeric ORDER BY cs.created_at DESC) FILTER (WHERE ${COACHING_PCT} IS NOT NULL))[1] AS latest_score
     FROM coaching_sessions cs
     WHERE cs.user_id = ANY($1::uuid[]) AND cs.status = 'completed'
     GROUP BY cs.user_id`,
    [ids]
  )
  for (const row of res.rows as { user_id: string; sessions: number; last_date: string; avg_score: string | null; first_score: string | null; latest_score: string | null }[]) {
    const phone = idToPhone.get(row.user_id)
    if (!phone) continue
    const first = row.first_score !== null ? Number(row.first_score) : null
    const latest = row.latest_score !== null ? Number(row.latest_score) : null
    map[phone] = {
      sessionsCompleted: row.sessions,
      firstScore: first,
      latestScore: latest,
      avgScore: row.avg_score !== null ? Number(row.avg_score) : null,
      improvement: first !== null && latest !== null ? Math.round((latest - first) * 10) / 10 : null,
      lastSessionDate: row.last_date,
    }
  }

  return map
}

export interface FeatureStat {
  teachers: number
  completed: number
}

export function summarizeLive(rows: OnboardingTeacher[], live: Record<string, LiveStatusInfo>, liveUnavailable: boolean) {
  let active = 0, joined = 0, pending = 0
  const bySchool: Record<string, number> = {}
  const features = {
    lessonPlans: { teachers: 0, completed: 0 } as FeatureStat,
    coaching:    { teachers: 0, completed: 0 } as FeatureStat,
    reading:     { teachers: 0, completed: 0 } as FeatureStat,
    video:       { teachers: 0, completed: 0 } as FeatureStat,
    image:       { teachers: 0, completed: 0 } as FeatureStat,
  }
  const usedAnyFeature = new Set<number>()

  for (const r of rows) {
    const status = resolveLiveStatus(r, live, liveUnavailable)
    if (status === 'active') active++
    else if (status === 'joined') joined++
    else pending++

    const usage = resolveUsage(r, live, liveUnavailable)
    if (usage.lpCompleted > 0)       { features.lessonPlans.teachers++; features.lessonPlans.completed += usage.lpCompleted;       usedAnyFeature.add(r.sno) }
    if (usage.coachingCompleted > 0) { features.coaching.teachers++;    features.coaching.completed    += usage.coachingCompleted; usedAnyFeature.add(r.sno) }
    if (usage.readingCompleted > 0)  { features.reading.teachers++;     features.reading.completed     += usage.readingCompleted;  usedAnyFeature.add(r.sno) }
    if (usage.videoCompleted > 0)    { features.video.teachers++;       features.video.completed       += usage.videoCompleted;    usedAnyFeature.add(r.sno) }
    if (usage.imageCompleted > 0)    { features.image.teachers++;       features.image.completed       += usage.imageCompleted;    usedAnyFeature.add(r.sno) }

    if (r.school) bySchool[r.school] = (bySchool[r.school] || 0) + 1
  }
  const total = rows.length
  const onboarded = active + joined
  return {
    total,
    active,
    onboarded,
    pending,
    onboardedPct: total ? Math.round((onboarded / total) * 100) : 0,
    schools: Object.keys(bySchool).length,
    totalLp: features.lessonPlans.completed,
    totalCoaching: features.coaching.completed,
    usedAnyFeature: usedAnyFeature.size,
    usedAnyFeaturePct: onboarded ? Math.round((usedAnyFeature.size / onboarded) * 100) : 0,
    features,
  }
}
