import { NextRequest, NextResponse } from 'next/server'
import { getSteadaData } from '@/lib/steda-phones'
import { TORCH_BEARER_NAMES, getGradeLevel } from '@/lib/torch-bearers'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function normName(s: string) {
  return s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
}

function isTorchBearer(csvName: string, waName: string): boolean {
  const csvWords = normName(csvName).split(' ').filter(w => w.length > 2)
  const waWords  = normName(waName).split(' ').filter(w => w.length > 2)
  return waWords.some(w => csvWords.includes(w))
}

const COHORT_GROUPS = ['Cohort - 1 (The Torch Bearers)', 'Rumi onboarding / Feedback']

// Pakistan Standard Time is UTC+5, so we add 5 hours
function pstHour(isoTimestamp: string): number | null {
  try {
    const d = new Date(isoTimestamp)
    if (isNaN(d.getTime())) return null
    return (d.getUTCHours() + 5) % 24
  } catch { return null }
}

function hourBucket(hour: number): string {
  if (hour <= 5)  return '0-5'
  if (hour <= 10) return '6-10'
  if (hour <= 13) return '11-13'
  if (hour <= 17) return '14-17'
  if (hour <= 21) return '18-21'
  return '22-23'
}

const HOUR_LABELS: Record<string, string> = {
  '0-5':   'Night (0–5)',
  '6-10':  'Morning (6–10)',
  '11-13': 'Midday (11–13)',
  '14-17': 'Afternoon (14–17)',
  '18-21': 'Evening (18–21)',
  '22-23': 'Late Night (22–23)',
}

const HOUR_ORDER = ['6-10', '11-13', '14-17', '18-21', '22-23', '0-5']

export async function GET(req: NextRequest) {
  try {
    const sp   = new URL(req.url).searchParams
    const from = sp.get('from') || null
    const to   = sp.get('to')   || null

    const { teachers } = getSteadaData()

    // Build torch bearer phone set
    const torchPhones = new Set<string>()
    for (const teacher of teachers) {
      for (const tbName of TORCH_BEARER_NAMES) {
        if (isTorchBearer(teacher.name, tbName)) { torchPhones.add(teacher.phone); break }
      }
    }

    // Build normTbWaName → { phone, designation, name }
    const normTbToTeacher = new Map<string, { phone: string; designation: string; name: string }>()
    for (const tbName of TORCH_BEARER_NAMES) {
      for (const teacher of teachers) {
        if (isTorchBearer(teacher.name, tbName) && torchPhones.has(teacher.phone)) {
          normTbToTeacher.set(normName(tbName), {
            phone: teacher.phone,
            designation: teacher.designation,
            name: teacher.name,
          })
          break
        }
      }
    }

    function senderTeacher(sender: string): { phone: string; designation: string; name: string } | null {
      const ns = normName(sender)
      const direct = normTbToTeacher.get(ns)
      if (direct) return direct
      const sWords = ns.split(' ').filter(w => w.length > 2)
      for (const [normTb, teacher] of normTbToTeacher) {
        const tbWords = normTb.split(' ').filter(w => w.length > 2)
        if (sWords.length > 0 && sWords.some(w => tbWords.includes(w))) return teacher
      }
      return null
    }

    // Fetch messages
    let query = supabase
      .from('whatsapp_messages')
      .select('sender, date, timestamp, sentiment, grp')
      .in('grp', COHORT_GROUPS)

    if (from) query = query.gte('date', from)
    if (to)   query = query.lte('date', to)

    const { data: waRows, error } = await query.order('timestamp', { ascending: true }).limit(10000)
    if (error) throw error

    const rows = waRows ?? []

    // Accumulators
    const timelineMap = new Map<string, number>()
    type DesigStat = { total: number; positive: number; question: number; issue: number; other: number }
    const byDesig = new Map<string, DesigStat>()
    type SenderStat = {
      sender: string; designation: string; grade_level: string
      total: number; positive: number; question: number; issue: number; other: number
    }
    const senderMap = new Map<string, SenderStat>()
    const hourMap = new Map<string, number>()
    let totalPos = 0, totalQ = 0, totalIss = 0, totalOth = 0

    for (const row of rows) {
      // Timeline
      if (row.date) timelineMap.set(row.date, (timelineMap.get(row.date) ?? 0) + 1)

      // Hourly (PKT = UTC+5)
      if (row.timestamp) {
        const h = pstHour(row.timestamp)
        if (h !== null) {
          const b = hourBucket(h)
          hourMap.set(b, (hourMap.get(b) ?? 0) + 1)
        }
      }

      // Sentiment totals
      const s = row.sentiment as string
      if (s === 'positive') totalPos++
      else if (s === 'question') totalQ++
      else if (s === 'issue') totalIss++
      else totalOth++

      // Teacher attribution
      const teacher = senderTeacher(row.sender)
      const desig = teacher?.designation ?? 'Unknown'
      const grade = getGradeLevel(desig)

      // by designation
      if (!byDesig.has(desig)) byDesig.set(desig, { total: 0, positive: 0, question: 0, issue: 0, other: 0 })
      const ds = byDesig.get(desig)!
      ds.total++
      if (s === 'positive') ds.positive++
      else if (s === 'question') ds.question++
      else if (s === 'issue') ds.issue++
      else ds.other++

      // per sender
      if (!senderMap.has(row.sender)) {
        senderMap.set(row.sender, { sender: row.sender, designation: desig, grade_level: grade, total: 0, positive: 0, question: 0, issue: 0, other: 0 })
      }
      const ss = senderMap.get(row.sender)!
      ss.total++
      if (s === 'positive') ss.positive++
      else if (s === 'question') ss.question++
      else if (s === 'issue') ss.issue++
      else ss.other++
    }

    const timeline = Array.from(timelineMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    const byDesignation = Array.from(byDesig.entries())
      .filter(([d]) => d !== 'Unknown')
      .map(([designation, stat]) => ({
        designation,
        grade_level: getGradeLevel(designation),
        ...stat,
      }))
      .sort((a, b) => b.total - a.total)

    const topSenders = Array.from(senderMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
      .map(s => ({
        ...s,
        dominant_sentiment: (
          [['positive', s.positive], ['question', s.question], ['issue', s.issue], ['other', s.other]] as [string, number][]
        ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other',
      }))

    const hourlyActivity = HOUR_ORDER.map(bucket => ({
      bucket,
      label: HOUR_LABELS[bucket],
      count: hourMap.get(bucket) ?? 0,
    }))

    const total = rows.length
    return NextResponse.json({
      timeline,
      byDesignation,
      topSenders,
      hourlyActivity,
      totals: { total, positive: totalPos, question: totalQ, issue: totalIss, other: totalOth },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
