import fs from 'fs'
import path from 'path'

// Reference list for the 20 SED pilot schools (10 boys' / 10 girls') across
// District Quetta and District Zhob — sourced from the DEO Zhob (Memo
// 4063-68/EB, 02 Jul 2026) and DEO Quetta (No.8355-63/GB(DEO), 10 Jul 2026)
// nomination letters. `users.region` only reaches province level and Rumi
// has no cohort concept, so district/school rollups depend entirely on this
// file. `enrolledTeachers` is the DEO-nominated headcount per school — the
// true "enrolled" denominator for activation rate — but it's only known for
// the 8 Zhob schools; the 12 Quetta schools didn't include a headcount in
// their nomination letter, so treat any enrolled-teacher total as a partial
// (lower-bound) figure, not a complete one. `cohort` is blank — neither
// letter specifies the WhatsApp cohort groupings of 40-50 teachers; that's
// still a separate open input.
export interface PilotSchool {
  schoolName: string
  emisCode: string
  district: string
  cohort: string
  gender: string
  enrolledTeachers: number | null
  headTeacherName: string
  headTeacherContact: string
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

let _cache: PilotSchool[] | null = null

// Returns [] (not a throw) when the file is missing or has no data rows yet —
// callers must treat an empty list as "reference data not yet available",
// not as "zero pilot schools".
export function getPilotSchools(): PilotSchool[] {
  if (_cache) return _cache

  const csvPath = path.join(process.cwd(), 'data', 'Balochistan_Pilot_Schools.csv')
  let content: string
  try {
    content = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '')
  } catch {
    _cache = []
    return _cache
  }

  const lines = content.split('\n').map(l => l.replace(/\r$/, ''))
  if (lines.length < 2) { _cache = []; return _cache }

  const headers = splitCSVRow(lines[0])
  const idx = {
    schoolName:      headers.indexOf('SchoolName'),
    emisCode:        headers.indexOf('EMISCode'),
    district:        headers.indexOf('District'),
    cohort:          headers.indexOf('Cohort'),
    gender:          headers.indexOf('Gender'),
    enrolledTeachers: headers.indexOf('EnrolledTeachers'),
    headTeacherName:  headers.indexOf('HeadTeacherName'),
    headTeacherContact: headers.indexOf('HeadTeacherContact'),
  }

  const rows: PilotSchool[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = splitCSVRow(line)
    const schoolName = (cols[idx.schoolName] || '').trim()
    if (!schoolName) continue
    const enrolledRaw = (cols[idx.enrolledTeachers] || '').trim()
    rows.push({
      schoolName,
      emisCode: (cols[idx.emisCode] || '').trim(),
      district: (cols[idx.district] || '').trim(),
      cohort:   (cols[idx.cohort]   || '').trim(),
      gender:   (cols[idx.gender]   || '').trim(),
      enrolledTeachers: enrolledRaw ? parseInt(enrolledRaw, 10) : null,
      headTeacherName: (cols[idx.headTeacherName] || '').trim(),
      headTeacherContact: (cols[idx.headTeacherContact] || '').trim(),
    })
  }

  _cache = rows
  return _cache
}

export interface EnrolledTeacherTotal {
  knownTotal: number
  schoolsWithKnownCount: number
  schoolsWithUnknownCount: number
  isComplete: boolean
}

// Sum of the DEO-nominated headcount across schools that reported one.
// `isComplete` is false whenever any school's count is missing — callers
// must present the total as a floor, not an exact enrolled population.
export function getEnrolledTeacherTotal(): EnrolledTeacherTotal {
  const schools = getPilotSchools()
  let knownTotal = 0, known = 0, unknown = 0
  for (const s of schools) {
    if (s.enrolledTeachers !== null) { knownTotal += s.enrolledTeachers; known++ }
    else unknown++
  }
  return { knownTotal, schoolsWithKnownCount: known, schoolsWithUnknownCount: unknown, isComplete: unknown === 0 }
}

function normalizeSchoolName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

// EMIS code is the reliable join key; normalized school_name is a fallback
// only (self-reported free text, same unreliability as users.organization).
export function findPilotSchool(emisCode: string | null, schoolName: string | null): PilotSchool | null {
  const schools = getPilotSchools()
  if (schools.length === 0) return null

  if (emisCode) {
    const byEmis = schools.find(s => s.emisCode && s.emisCode === emisCode.trim())
    if (byEmis) return byEmis
  }
  if (schoolName) {
    const norm = normalizeSchoolName(schoolName)
    const byName = schools.find(s => normalizeSchoolName(s.schoolName) === norm)
    if (byName) return byName
  }
  return null
}
