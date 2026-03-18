import fs from 'fs'
import path from 'path'

export interface SteadaTeacher {
  phone: string
  district: string
  designation: string
  gender: string
  schoolType: string // Public | Private
}

export interface SteadaData {
  phones: string[]
  teachers: SteadaTeacher[]
  demographics: {
    gender: Record<string, number>
    schoolType: Record<string, number>
  }
  designations: Record<string, number>
  districtListed: Record<string, number>
}

function normPhone(raw: string): string | null {
  if (!raw) return null
  let p = raw.replace(/[\s\-\(\)]/g, '')
  if (!p) return null
  if (p.startsWith('0'))   return '92' + p.slice(1)
  if (p.startsWith('+92')) return p.slice(1)
  if (p.startsWith('92'))  return p
  return '92' + p
}

// Simple CSV row splitter that handles quoted fields
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

let _cache: SteadaData | null = null

export function getSteadaData(): SteadaData {
  if (_cache) return _cache

  // CSV is one level up from rumi-dashboard/
  const csvPath = path.join(process.cwd(), '..', 'STEDA List of Teachers-1 .csv')
  const raw = fs.readFileSync(csvPath, 'utf-8')
  // Strip BOM if present
  const content = raw.replace(/^\uFEFF/, '')
  const lines = content.split('\n').map(l => l.replace(/\r$/, ''))

  if (lines.length < 2) throw new Error('CSV appears empty')

  const headers = splitCSVRow(lines[0])
  const idx = {
    phone:       headers.indexOf('WhatsappNo'),
    district:    headers.indexOf('District'),
    designation: headers.indexOf('Designation'),
    gender:      headers.indexOf('Gender'),
    schoolType:  headers.indexOf('Government_Private'),
  }

  const teachers: SteadaTeacher[] = []
  const phones: string[] = []
  const gender: Record<string, number> = {}
  const schoolType: Record<string, number> = {}
  const designations: Record<string, number> = {}
  const districtListed: Record<string, number> = {}

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = splitCSVRow(line)

    const rawPhone    = cols[idx.phone]    || ''
    const district    = (cols[idx.district]    || '').trim()
    const designation = (cols[idx.designation] || '').trim()
    const gen         = (cols[idx.gender]      || '').trim()
    const sType       = (cols[idx.schoolType]  || '').trim()

    const phone = normPhone(rawPhone)
    if (!phone) continue

    phones.push(phone)
    teachers.push({ phone, district, designation, gender: gen, schoolType: sType })

    gender[gen]         = (gender[gen] || 0) + 1
    schoolType[sType]   = (schoolType[sType] || 0) + 1
    designations[designation] = (designations[designation] || 0) + 1
    if (district) districtListed[district] = (districtListed[district] || 0) + 1
  }

  _cache = { phones, teachers, demographics: { gender, schoolType }, designations, districtListed }
  return _cache
}
