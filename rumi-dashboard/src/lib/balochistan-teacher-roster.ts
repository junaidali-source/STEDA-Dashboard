import fs from 'fs'
import path from 'path'

// The real, DEO-confirmed teacher roster for the 20 Balochistan SED pilot
// schools — 169 named teachers with phone numbers, cross-verified against
// live Rumi data in Aug 2026. This supersedes the self-reported
// region+date-cutoff approximation as the source of truth for "enrolled."
export interface RosterTeacher {
  name: string
  phone: string | null
  schoolName: string
  emisCode: string
  district: string
  gender: string
  notes: string
}

function normPhone(raw: string): string | null {
  if (!raw) return null
  if (/^UNCONFIRMED$/i.test(raw.trim())) return null
  const p = raw.replace(/[\s\-\(\)]/g, '')
  if (!p) return null
  if (p.startsWith('0')) return '92' + p.slice(1)
  if (p.startsWith('+92')) return p.slice(1)
  if (p.startsWith('92')) return p
  return '92' + p
}

// Notes may contain embedded commas (unquoted in the source file), so only
// the first 6 columns are split normally — everything after is rejoined as
// the Notes field.
function splitRow(line: string): string[] {
  const parts = line.split(',')
  const fixed = parts.slice(0, 6)
  const notes = parts.slice(6).join(',').trim()
  return [...fixed.map(p => p.trim()), notes]
}

let _cache: RosterTeacher[] | null = null

// Returns [] (not a throw) when the file is missing — callers must treat an
// empty roster as "not available," not as "zero enrolled teachers."
export function getTeacherRoster(): RosterTeacher[] {
  if (_cache) return _cache

  const csvPath = path.join(process.cwd(), 'data', 'Balochistan_Teacher_Roster.csv')
  let content: string
  try {
    content = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '')
  } catch {
    _cache = []
    return _cache
  }

  const lines = content.split('\n').map(l => l.replace(/\r$/, ''))
  if (lines.length < 2) { _cache = []; return _cache }

  const rows: RosterTeacher[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const [name, phoneRaw, schoolName, emisCode, district, gender, notes] = splitRow(line)
    if (!name) continue
    rows.push({ name, phone: normPhone(phoneRaw), schoolName, emisCode, district, gender, notes })
  }

  _cache = rows
  return _cache
}

export function getRosterPhones(): string[] {
  return Array.from(new Set(getTeacherRoster().map(r => r.phone).filter((p): p is string => !!p)))
}
