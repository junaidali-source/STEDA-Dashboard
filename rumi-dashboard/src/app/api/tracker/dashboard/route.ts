import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getSteadaData } from '@/lib/steda-phones'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Compute live KPIs from the main database
async function computeLiveMetrics() {
  const { phones, teachers } = getSteadaData()
  const totalListed = teachers.length

  if (phones.length === 0) return null

  // Get STEDA user IDs
  const joinedRes = await pool.query(
    `SELECT id FROM users WHERE phone_number = ANY($1::text[]) AND COALESCE(is_test_user, false) = false`,
    [phones]
  )
  const ids: string[] = joinedRes.rows.map((r: { id: string }) => r.id)
  const totalJoined = ids.length

  if (ids.length === 0) {
    return {
      teachers_listed: totalListed, teachers_joined: 0, joined_pct: 0,
      used_any_feature: 0, used_any_pct: 0,
      total_requests: 0, completion_pct: 0,
      lp_teachers: 0, lp_requests: 0, lp_completion: 0,
      coaching_teachers: 0,
      video_teachers: 0, video_completion: 0,
      image_teachers: 0,
      depth_0: totalListed, depth_1: 0, depth_2: 0, depth_3: 0,
      community_members: null,
      source: 'live',
    }
  }

  const [lpRes, csRes, vrRes, iaRes, anyRes, depthRes, totalReqRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER(WHERE status='completed')::int AS completed,
              COUNT(DISTINCT user_id)::int AS users
       FROM lesson_plan_requests WHERE user_id = ANY($1::uuid[])`, [ids]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT user_id)::int AS users FROM coaching_sessions WHERE user_id = ANY($1::uuid[])`, [ids]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER(WHERE status='completed')::int AS completed,
              COUNT(DISTINCT user_id)::int AS users
       FROM video_requests WHERE user_id = ANY($1::uuid[])`, [ids]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT user_id)::int AS users FROM image_analysis_requests WHERE user_id = ANY($1::uuid[])`, [ids]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT user_id)::int AS any_feature_users FROM (
         SELECT user_id FROM lesson_plan_requests    WHERE user_id = ANY($1::uuid[])
         UNION SELECT user_id FROM coaching_sessions  WHERE user_id = ANY($1::uuid[])
         UNION SELECT user_id FROM video_requests     WHERE user_id = ANY($1::uuid[])
         UNION SELECT user_id FROM image_analysis_requests WHERE user_id = ANY($1::uuid[])
       ) sub`, [ids]
    ),
    pool.query(
      `SELECT feature_count, COUNT(*)::int AS teachers FROM (
         SELECT user_id,
           (CASE WHEN lp  > 0 THEN 1 ELSE 0 END +
            CASE WHEN cs  > 0 THEN 1 ELSE 0 END +
            CASE WHEN vr  > 0 THEN 1 ELSE 0 END +
            CASE WHEN ia  > 0 THEN 1 ELSE 0 END) AS feature_count
         FROM (
           SELECT u.id AS user_id,
             COUNT(DISTINCT lp.id) AS lp, COUNT(DISTINCT cs.id) AS cs,
             COUNT(DISTINCT vr.id) AS vr, COUNT(DISTINCT ia.id) AS ia
           FROM unnest($1::uuid[]) AS u(id)
           LEFT JOIN lesson_plan_requests     lp ON lp.user_id = u.id
           LEFT JOIN coaching_sessions        cs ON cs.user_id = u.id
           LEFT JOIN video_requests           vr ON vr.user_id = u.id
           LEFT JOIN image_analysis_requests  ia ON ia.user_id = u.id
           GROUP BY u.id
         ) counts
       ) depth_counts GROUP BY feature_count`, [ids]
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER(WHERE status='completed')::int AS completed
       FROM (
         SELECT id, status FROM lesson_plan_requests WHERE user_id = ANY($1::uuid[])
         UNION ALL SELECT id, status FROM video_requests     WHERE user_id = ANY($1::uuid[])
         UNION ALL SELECT id, status FROM image_analysis_requests WHERE user_id = ANY($1::uuid[])
       ) all_reqs`, [ids]
    ),
  ])

  // Depth breakdown
  const depthMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
  for (const r of depthRes.rows) {
    const k = Math.min(r.feature_count, 3)
    depthMap[k] = (depthMap[k] || 0) + r.teachers
  }
  // depth_0 includes joined teachers who used nothing
  const usedAny = anyRes.rows[0].any_feature_users ?? 0
  depthMap[0] = totalJoined - usedAny

  const lp = lpRes.rows[0]
  const vr = vrRes.rows[0]
  const tr = totalReqRes.rows[0]
  const usedAnyPct = totalJoined > 0 ? Math.round((usedAny / totalJoined) * 100) : 0

  // Community members from WhatsApp messages (same Supabase project)
  let communityMembers: number | null = null
  try {
    const { data } = await supabase.from('whatsapp_messages').select('sender_phone')
    if (data) {
      communityMembers = new Set(data.map((r: { sender_phone: string }) => r.sender_phone)).size
    }
  } catch { /* ignore */ }

  return {
    teachers_listed:    totalListed,
    teachers_joined:    totalJoined,
    joined_pct:         Math.round((totalJoined / totalListed) * 100),
    used_any_feature:   usedAny,
    used_any_pct:       usedAnyPct,
    total_requests:     tr.total ?? 0,
    completion_pct:     tr.total > 0 ? Math.round((tr.completed / tr.total) * 100) : 0,
    lp_teachers:        lp.users  ?? 0,
    lp_requests:        lp.total  ?? 0,
    lp_completion:      lp.total  > 0 ? Math.round((lp.completed / lp.total) * 100) : 0,
    coaching_teachers:  csRes.rows[0].users  ?? 0,
    video_teachers:     vr.users  ?? 0,
    video_completion:   vr.total  > 0 ? Math.round((vr.completed / vr.total) * 100) : 0,
    image_teachers:     iaRes.rows[0].users ?? 0,
    depth_0:            depthMap[0],
    depth_1:            depthMap[1],
    depth_2:            depthMap[2],
    depth_3:            depthMap[3],
    community_members:  communityMembers,
    source:             'live',
    snapshot_date:      new Date().toISOString().slice(0, 10),
  }
}

// Auto-save snapshot if no snapshot exists for today
async function autoSaveSnapshot(metrics: ReturnType<typeof computeLiveMetrics> extends Promise<infer T> ? T : never) {
  if (!metrics) return
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('metric_snapshots')
      .select('id')
      .eq('snapshot_date', today)
      .limit(1)

    if (data && data.length > 0) return // already saved today

    await supabase.from('metric_snapshots').insert({
      snapshot_date:    today,
      teachers_listed:  metrics.teachers_listed,
      teachers_joined:  metrics.teachers_joined,
      joined_pct:       metrics.joined_pct,
      used_any_feature: metrics.used_any_feature,
      used_any_pct:     metrics.used_any_pct,
      total_requests:   metrics.total_requests,
      completion_pct:   metrics.completion_pct,
      lp_teachers:      metrics.lp_teachers,
      lp_requests:      metrics.lp_requests,
      lp_completion:    metrics.lp_completion,
      coaching_teachers:metrics.coaching_teachers,
      video_teachers:   metrics.video_teachers,
      video_completion: metrics.video_completion,
      image_teachers:   metrics.image_teachers,
      depth_0:          metrics.depth_0,
      depth_1:          metrics.depth_1,
      depth_2:          metrics.depth_2,
      depth_3:          metrics.depth_3,
      community_members:metrics.community_members,
      source:           'auto',
    })
  } catch { /* non-critical */ }
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn() } catch { return fallback }
}

export async function GET() {
  try {
    const [liveMetrics, milestones, actions, targets] = await Promise.all([
      safeQuery(computeLiveMetrics, null),
      safeQuery(() => supabase.from('plan_milestones').select('*').order('sort_order').then(r => r.data ?? []), []),
      safeQuery(() => supabase.from('action_items')
        .select('*, meeting_minutes(title, meeting_date)')
        .eq('status', 'open')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(50)
        .then(r => (r.data ?? []).map((a: Record<string, unknown>) => {
          const mm = a.meeting_minutes as { title?: string; meeting_date?: string } | null
          return { ...a, meeting_minutes: undefined, meeting_title: mm?.title ?? null, meeting_date: mm?.meeting_date ?? null }
        })), []),
      safeQuery(() => supabase.from('kpi_targets').select('*').then(r => r.data ?? []), []),
    ])

    // Auto-save daily snapshot in background (non-blocking)
    if (liveMetrics) autoSaveSnapshot(liveMetrics).catch(() => {})

    return NextResponse.json({ snapshot: liveMetrics, milestones, actions, targets })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
