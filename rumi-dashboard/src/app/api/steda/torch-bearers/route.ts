import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getSteadaData } from '@/lib/steda-phones'
import { TORCH_BEARER_NAMES, getGradeLevel } from '@/lib/torch-bearers'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Normalise name for fuzzy comparison
function normName(s: string) {
  return s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
}

// Check if a CSV name matches a Torch Bearer WA name (word-overlap heuristic)
function isTorchBearer(csvName: string, waName: string): boolean {
  const csvWords = normName(csvName).split(' ').filter(w => w.length > 2)
  const waWords  = normName(waName).split(' ').filter(w => w.length > 2)
  return waWords.some(w => csvWords.includes(w))
}

const SCORE_FILTER = `cs.status='completed' AND cs.analysis_data IS NOT NULL`
const PCT = `COALESCE(cs.analysis_data->'scores'->>'percentage', cs.analysis_data->'scores'->>'overall_percentage')`

const COHORT_GROUPS = ['Cohort - 1 (The Torch Bearers)', 'Rumi onboarding / Feedback']

export async function GET(req: NextRequest) {
  try {
    const sp   = new URL(req.url).searchParams
    const from = sp.get('from') || null
    const to   = sp.get('to')   || null

    const { phones, teachers } = getSteadaData()
    const teacherByPhone = new Map(teachers.map(t => [t.phone, t]))

    // Build a set of phone numbers for Torch Bearers using name matching
    const torchPhones = new Set<string>()
    for (const teacher of teachers) {
      for (const tbName of TORCH_BEARER_NAMES) {
        if (isTorchBearer(teacher.name, tbName)) {
          torchPhones.add(teacher.phone)
          break
        }
      }
    }

    // Build normTbWaName → phone mapping (for WA message attribution)
    const normTbToPhone = new Map<string, string>()
    for (const tbName of TORCH_BEARER_NAMES) {
      for (const teacher of teachers) {
        if (isTorchBearer(teacher.name, tbName) && torchPhones.has(teacher.phone)) {
          normTbToPhone.set(normName(tbName), teacher.phone)
          break
        }
      }
    }

    function senderPhone(sender: string): string | null {
      const ns = normName(sender)
      const direct = normTbToPhone.get(ns)
      if (direct) return direct
      const sWords = ns.split(' ').filter(w => w.length > 2)
      for (const [normTb, phone] of normTbToPhone) {
        const tbWords = normTb.split(' ').filter(w => w.length > 2)
        if (sWords.length > 0 && sWords.some(w => tbWords.includes(w))) return phone
      }
      return null
    }

    // Get all STEDA user IDs
    const idsRes = await pool.query(
      `SELECT id, phone_number FROM users
       WHERE phone_number = ANY($1::text[]) AND COALESCE(is_test_user,false)=false`,
      [phones]
    )
    const allIds = idsRes.rows.map((r: { id: string; phone_number: string }) => r.id)
    const phoneByUserId = new Map(idsRes.rows.map((r: { id: string; phone_number: string }) => [r.id, r.phone_number]))

    if (allIds.length === 0) return NextResponse.json({ torch: [], similar: [], stats: {} })

    const JOIN_DC =
      `AND ($2::date IS NULL OR cs.created_at::date >= $2::date)
       AND ($3::date IS NULL OR cs.created_at::date <= $3::date)`

    const res = await pool.query(
      `SELECT
         u.id,
         TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS name,
         u.phone_number,
         COALESCE(u.school_name,'—') AS school,
         COALESCE(u.preferred_language,'—') AS language,
         u.created_at::date AS joined,
         COUNT(cs.id)::int AS total_sessions,
         COUNT(cs.id) FILTER(WHERE cs.status='completed')::int AS completed_sessions,
         MIN(cs.created_at)::date AS first_session,
         MAX(cs.created_at)::date AS last_session,
         ROUND(AVG((${PCT})::numeric) FILTER(WHERE ${SCORE_FILTER}),1) AS avg_score,
         (array_agg((${PCT})::numeric ORDER BY cs.created_at ASC)  FILTER(WHERE ${SCORE_FILTER}))[1] AS first_score,
         (array_agg((${PCT})::numeric ORDER BY cs.created_at DESC) FILTER(WHERE ${SCORE_FILTER}))[1] AS latest_score,
         ROUND(AVG(COALESCE(
           (cs.analysis_data->'scores'->>'goal1_total')::numeric,
           (cs.analysis_data->'goal1_formative_assessment'->>'area_score')::numeric,
           (cs.analysis_data->'scores'->'goal_scores'->'goal1_formative_assessment'->>'area_score')::numeric,
           (cs.analysis_data->'scores'->'goal1_score'->>'score')::numeric
         )) FILTER(WHERE ${SCORE_FILTER}), 1) AS avg_g1,
         ROUND(AVG(COALESCE(
           (cs.analysis_data->'scores'->>'goal2_total')::numeric,
           (cs.analysis_data->'goal2_student_engagement'->>'area_score')::numeric,
           (cs.analysis_data->'scores'->'goal_scores'->'goal2_student_engagement'->>'area_score')::numeric,
           (cs.analysis_data->'scores'->'goal2_score'->>'score')::numeric
         )) FILTER(WHERE ${SCORE_FILTER}), 1) AS avg_g2,
         ROUND(AVG(COALESCE(
           (cs.analysis_data->'scores'->>'goal3_total')::numeric,
           (cs.analysis_data->'goal3_quality_content'->>'area_score')::numeric,
           (cs.analysis_data->'scores'->'goal_scores'->'goal3_quality_content'->>'area_score')::numeric,
           (cs.analysis_data->'scores'->'goal3_score'->>'score')::numeric
         )) FILTER(WHERE ${SCORE_FILTER}), 1) AS avg_g3,
         ROUND(AVG(COALESCE(
           (cs.analysis_data->'scores'->>'goal4_total')::numeric,
           (cs.analysis_data->'goal4_classroom_interaction'->>'area_score')::numeric,
           (cs.analysis_data->'scores'->'goal_scores'->'goal4_classroom_interaction'->>'area_score')::numeric,
           (cs.analysis_data->'scores'->'goal4_score'->>'score')::numeric
         )) FILTER(WHERE ${SCORE_FILTER}), 1) AS avg_g4,
         ROUND(AVG(COALESCE(
           (cs.analysis_data->'scores'->>'goal5_total')::numeric,
           (cs.analysis_data->'goal5_classroom_management'->>'area_score')::numeric,
           (cs.analysis_data->'scores'->'goal_scores'->'goal5_classroom_management'->>'area_score')::numeric,
           (cs.analysis_data->'scores'->'goal5_score'->>'score')::numeric
         )) FILTER(WHERE ${SCORE_FILTER}), 1) AS avg_g5
       FROM users u
       LEFT JOIN coaching_sessions cs ON cs.user_id = u.id ${JOIN_DC}
       WHERE u.id = ANY($1::uuid[])
       GROUP BY u.id, u.first_name, u.last_name, u.phone_number, u.school_name, u.preferred_language, u.created_at
       ORDER BY completed_sessions DESC, total_sessions DESC, u.first_name
       LIMIT 2000`,
      [allIds, from, to]
    )

    // ── Fetch WA messages and aggregate per teacher ───────────────────────────
    type WaStat = {
      total: number; positive: number; question: number; issue: number; other: number
      dates: Set<string>; lastActive: string | null
    }
    const waByPhone = new Map<string, WaStat>()

    const { data: waRows } = await supabase
      .from('whatsapp_messages')
      .select('sender, date, sentiment')
      .in('grp', COHORT_GROUPS)
      .limit(10000)

    for (const row of (waRows ?? [])) {
      const phone = senderPhone(row.sender)
      if (!phone) continue
      if (!waByPhone.has(phone)) {
        waByPhone.set(phone, { total: 0, positive: 0, question: 0, issue: 0, other: 0, dates: new Set(), lastActive: null })
      }
      const stat = waByPhone.get(phone)!
      stat.total++
      if (row.sentiment === 'positive') stat.positive++
      else if (row.sentiment === 'question') stat.question++
      else if (row.sentiment === 'issue') stat.issue++
      else stat.other++
      if (row.date) {
        stat.dates.add(row.date)
        if (!stat.lastActive || row.date > stat.lastActive) stat.lastActive = row.date
      }
    }

    type UserRow = {
      id: string; name: string; phone_number: string; school: string; language: string; joined: string
      total_sessions: number; completed_sessions: number; first_session: string | null; last_session: string | null
      avg_score: number | null; first_score: number | null; latest_score: number | null
      avg_g1: number | null; avg_g2: number | null; avg_g3: number | null; avg_g4: number | null; avg_g5: number | null
      district: string; designation: string; gender: string; grade_level: string
      is_torch_bearer: boolean; improvement: number | null
      wa_messages_total: number
      wa_sentiment: { positive: number; question: number; issue: number; other: number }
      wa_last_active: string | null; wa_active_days: number
    }

    const rows: UserRow[] = res.rows.map((r: Record<string, unknown>) => {
      const phone = r.phone_number as string
      const t = teacherByPhone.get(phone)
      const isTB = torchPhones.has(phone)
      const first  = r.first_score  as number | null
      const latest = r.latest_score as number | null
      const waStat = waByPhone.get(phone)
      return {
        ...r,
        district:          t?.district    ?? '—',
        designation:       t?.designation ?? '—',
        gender:            t?.gender      ?? '—',
        grade_level:       getGradeLevel(t?.designation ?? ''),
        is_torch_bearer:   isTB,
        improvement: first != null && latest != null ? Math.round((latest - first) * 10) / 10 : null,
        wa_messages_total: waStat?.total ?? 0,
        wa_sentiment: waStat
          ? { positive: waStat.positive, question: waStat.question, issue: waStat.issue, other: waStat.other }
          : { positive: 0, question: 0, issue: 0, other: 0 },
        wa_last_active: waStat?.lastActive ?? null,
        wa_active_days: waStat?.dates.size ?? 0,
      } as UserRow
    })

    // Suppress unused variable warning
    void phoneByUserId

    const torch   = rows.filter(r => r.is_torch_bearer)
    const others  = rows.filter(r => !r.is_torch_bearer)

    // ── Commonalities among Torch Bearers ─────────────────────────────────────
    const districtFreq: Record<string, number> = {}
    const designationFreq: Record<string, number> = {}
    const genderFreq: Record<string, number> = {}
    const g1Vals: number[] = [], g2Vals: number[] = [], g3Vals: number[] = []
    const g4Vals: number[] = [], g5Vals: number[] = []

    for (const t of torch) {
      if (t.district && t.district !== '—')         districtFreq[t.district]       = (districtFreq[t.district] || 0) + 1
      if (t.designation && t.designation !== '—')   designationFreq[t.designation] = (designationFreq[t.designation] || 0) + 1
      if (t.gender && t.gender !== '—')             genderFreq[t.gender]           = (genderFreq[t.gender] || 0) + 1
      if (t.avg_g1 != null) g1Vals.push(t.avg_g1)
      if (t.avg_g2 != null) g2Vals.push(t.avg_g2)
      if (t.avg_g3 != null) g3Vals.push(t.avg_g3)
      if (t.avg_g4 != null) g4Vals.push(t.avg_g4)
      if (t.avg_g5 != null) g5Vals.push(t.avg_g5)
    }

    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 10) / 10 : null

    const topDistricts = Object.entries(districtFreq).sort((a,b)=>b[1]-a[1]).slice(0,5)

    const avgScore      = torch.length ? torch.reduce((s,t)=>s+(t.avg_score||0),0)/torch.filter(t=>t.avg_score!=null).length : 0
    const avgSessions   = torch.length ? torch.reduce((s,t)=>s+t.completed_sessions,0)/torch.length : 0
    const avgImprove    = torch.filter(t=>t.improvement!=null).length
      ? torch.filter(t=>t.improvement!=null).reduce((s,t)=>s+(t.improvement!),0)/torch.filter(t=>t.improvement!=null).length
      : 0

    // ── Find Similar non-Torch teachers ───────────────────────────────────────
    const topDistrictSet = new Set(topDistricts.slice(0,3).map(d=>d[0]))
    const dominantDesig  = Object.entries(designationFreq).sort((a,b)=>b[1]-a[1])[0]?.[0]

    const similar = others
      .filter(o => o.completed_sessions >= 1)
      .map(o => {
        let score = 0
        if (topDistrictSet.has(o.district))                   score += 2
        if (o.designation === dominantDesig)                   score += 1
        if (o.avg_score != null && Math.abs((o.avg_score||0) - avgScore) < 10) score += 2
        if (o.completed_sessions >= Math.round(avgSessions))   score += 2
        if (o.improvement != null && o.improvement > 0)       score += 1
        return { ...o, similarity_score: score }
      })
      .sort((a,b) => b.similarity_score - a.similarity_score || b.completed_sessions - a.completed_sessions)
      .slice(0, 20)

    const stats = {
      total_torch_bearers_matched: torch.length,
      total_torch_bearers_expected: TORCH_BEARER_NAMES.length,
      avg_score:      Math.round(avgScore * 10) / 10,
      avg_sessions:   Math.round(avgSessions * 10) / 10,
      avg_improvement: Math.round(avgImprove * 10) / 10,
      top_districts:  topDistricts,
      designation_breakdown: designationFreq,
      gender_breakdown: genderFreq,
      sessions_with_data: torch.filter(t => t.completed_sessions > 0).length,
      hots_avg: {
        g1: avg(g1Vals), g2: avg(g2Vals), g3: avg(g3Vals), g4: avg(g4Vals), g5: avg(g5Vals),
      },
    }

    return NextResponse.json({ torch, similar, stats })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
