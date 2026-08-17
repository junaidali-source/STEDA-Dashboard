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
    sno:      headers.indexOf('S.No'),
    name:     headers.indexOf('Name'),
    role:     headers.indexOf('Role'),
    subject:  headers.indexOf('Subject'),
    class:    headers.indexOf('Class'),
    waLocal:  headers.indexOf('WhatsApp (Local)'),
    waIntl:   headers.indexOf('WhatsApp (Intl)'),
    school:   headers.indexOf('School'),
    emis:     headers.indexOf('EMIS Code'),
    district: headers.indexOf('District'),
    province: headers.indexOf('Province'),
    status:   headers.indexOf('Onboarding Status'),
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
}

// Cross-checks each teacher's WhatsApp number against real product usage:
// 'active' = has a Rumi account AND has used at least one AI feature
// 'joined' = has a Rumi account but hasn't used a feature yet
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
    map[row.phone_number] = { joined: true, active: false }
  }

  const ids = Array.from(idToPhone.keys())
  if (ids.length === 0) return map

  const activeRes = await pool.query(
    `SELECT DISTINCT user_id FROM (
       SELECT user_id FROM lesson_plan_requests   WHERE user_id = ANY($1::uuid[])
       UNION SELECT user_id FROM coaching_sessions       WHERE user_id = ANY($1::uuid[])
       UNION SELECT user_id FROM video_requests          WHERE user_id = ANY($1::uuid[])
       UNION SELECT user_id FROM image_analysis_requests WHERE user_id = ANY($1::uuid[])
       UNION SELECT user_id FROM reading_assessments     WHERE user_id = ANY($1::uuid[])
     ) sub`,
    [ids]
  )
  for (const row of activeRes.rows as { user_id: string }[]) {
    const phone = idToPhone.get(row.user_id)
    if (phone) map[phone].active = true
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

export function summarizeLive(rows: OnboardingTeacher[], live: Record<string, LiveStatusInfo>, liveUnavailable: boolean) {
  let active = 0, joined = 0, pending = 0
  const bySchool: Record<string, number> = {}
  for (const r of rows) {
    const status = resolveLiveStatus(r, live, liveUnavailable)
    if (status === 'active') active++
    else if (status === 'joined') joined++
    else pending++
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
  }
}
