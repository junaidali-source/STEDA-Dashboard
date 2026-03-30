import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getSteadaData } from '@/lib/steda-phones'
import { createClient } from '@supabase/supabase-js'

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

  // Community members from WhatsApp Supabase
  let communityMembers: number | null = null
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    )
    const { data } = await sb
      .from('whatsapp_messages')
      .select('sender_phone')
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
    const { rows } = await pool.query(
      `SELECT id FROM metric_snapshots WHERE snapshot_date = $1`, [today]
    )
    if (rows.length > 0) return // already saved today

    await pool.query(
      `INSERT INTO metric_snapshots (
         snapshot_date, teachers_listed, teachers_joined, joined_pct,
         used_any_feature, used_any_pct, total_requests, completion_pct,
         lp_teachers, lp_requests, lp_completion, coaching_teachers,
         video_teachers, video_completion, image_teachers,
         depth_0, depth_1, depth_2, depth_3, community_members, source
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        today,
        metrics.teachers_listed, metrics.teachers_joined, metrics.joined_pct,
        metrics.used_any_feature, metrics.used_any_pct,
        metrics.total_requests, metrics.completion_pct,
        metrics.lp_teachers, metrics.lp_requests, metrics.lp_completion,
        metrics.coaching_teachers,
        metrics.video_teachers, metrics.video_completion,
        metrics.image_teachers,
        metrics.depth_0, metrics.depth_1, metrics.depth_2, metrics.depth_3,
        metrics.community_members, 'auto',
      ]
    )
  } catch { /* non-critical */ }
}

export async function GET() {
  try {
    const [liveMetrics, milestonesRes, actionsRes, targetsRes] = await Promise.all([
      computeLiveMetrics(),
      pool.query(`SELECT * FROM plan_milestones ORDER BY sort_order`),
      pool.query(`
        SELECT ai.*, mm.title AS meeting_title, mm.meeting_date
        FROM action_items ai
        LEFT JOIN meeting_minutes mm ON mm.id = ai.meeting_id
        WHERE ai.status = 'open'
        ORDER BY
          CASE ai.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          ai.due_date ASC NULLS LAST
        LIMIT 50
      `),
      pool.query(`SELECT * FROM kpi_targets`),
    ])

    // Auto-save daily snapshot in background (non-blocking)
    if (liveMetrics) autoSaveSnapshot(liveMetrics).catch(() => {})

    return NextResponse.json({
      snapshot:   liveMetrics,
      milestones: milestonesRes.rows,
      actions:    actionsRes.rows,
      targets:    targetsRes.rows,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
