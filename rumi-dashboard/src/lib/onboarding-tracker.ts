import fs from 'fs'
import path from 'path'

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

export function summarize(rows: OnboardingTeacher[]) {
  const byStatus: Record<string, number> = {}
  const bySubject: Record<string, number> = {}
  const bySchool: Record<string, number> = {}
  for (const r of rows) {
    byStatus[r.status]  = (byStatus[r.status] || 0) + 1
    if (r.subject) for (const s of r.subject.split(',').map(x => x.trim()).filter(Boolean)) {
      bySubject[s] = (bySubject[s] || 0) + 1
    }
    if (r.school) bySchool[r.school] = (bySchool[r.school] || 0) + 1
  }
  const onboarded = rows.filter(r => r.status.toLowerCase() === 'onboarded').length
  return {
    total: rows.length,
    onboarded,
    pending: rows.length - onboarded,
    onboardedPct: rows.length ? Math.round((onboarded / rows.length) * 100) : 0,
    schools: Object.keys(bySchool).length,
    byStatus,
    bySubject,
    bySchool,
  }
}
