/**
 * seed-tracker.js
 * Creates tracker tables (if not exists) and inserts PDF data
 * Run: node scripts/seed-tracker.js
 */

const { Pool } = require('../rumi-dashboard/node_modules/pg')

const pool = new Pool({
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'analyst.jlpenspfdcwxkopaidys',
  password: 'RumiAnalyst2026secure',
  ssl: { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 15000,
})

async function run() {
  const client = await pool.connect()
  try {
    console.log('Connected to DB')

    // ── 1. Set search path + check role ──────────────────────────────────────
    await client.query(`SET search_path TO public`)
    const { rows: roleRows } = await client.query(`SELECT current_user, session_user, current_schema()`)
    console.log('Connected as:', roleRows[0])

    // ── verify main DB tables accessible ─────────────────────────────────────
    const { rows: tableList } = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`)
    console.log('Tables visible:', tableList.map(r => r.table_name).join(', '))

    // ── 2. Metric snapshot from PDF (March 30 2026) ───────────────────────────
    await client.query(`
      INSERT INTO metric_snapshots (
        snapshot_date, teachers_listed, teachers_joined, joined_pct,
        used_any_feature, used_any_pct,
        total_requests, completion_pct,
        lp_teachers, lp_requests, lp_completion,
        coaching_teachers,
        video_teachers, video_completion,
        image_teachers,
        depth_0, depth_1, depth_2, depth_3,
        community_members, source
      )
      VALUES (
        '2026-03-30', 1346, 909, 68,
        427, 47,
        1354, 96,
        409, 1157, 98,
        1,
        37, 55,
        47,
        482, 364, 57, 6,
        481, 'pdf_upload_v2'
      )
      ON CONFLICT DO NOTHING
    `)
    console.log('Metric snapshot inserted')

    // ── 3. KPI targets ────────────────────────────────────────────────────────
    // Delete existing targets and re-seed with PDF v2 targets
    await client.query(`DELETE FROM kpi_targets`)
    await client.query(`
      INSERT INTO kpi_targets (metric_key, target_value, target_date, description) VALUES
        ('joined_pct',      85,  '2026-04-30', 'Teachers joined Rumi (%)'),
        ('used_any_pct',    70,  '2026-04-30', 'Joined teachers who used any feature (%)'),
        ('completion_pct',  95,  '2026-04-30', 'Overall AI request completion rate (%)'),
        ('lp_completion',   95,  '2026-04-30', 'Lesson plan completion rate (%)'),
        ('video_completion',80,  '2026-04-30', 'Video analysis completion rate (%)'),
        ('community_members',700,'2026-04-30', 'Teachers in community WhatsApp group'),
        ('depth_2_pct',     30,  '2026-04-30', 'Teachers with 2+ feature depth (%)')
    `)
    console.log('KPI targets seeded')

    // ── 4. Plan milestones ────────────────────────────────────────────────────
    // Check if milestones already seeded
    const { rows: existing } = await client.query(`SELECT count(*) FROM plan_milestones`)
    if (parseInt(existing[0].count) === 0) {
      await client.query(`
        INSERT INTO plan_milestones (title, phase, start_date, end_date, status, description, success_metric, actual_result, sort_order) VALUES
          ('Phase 1A — Initial Onboarding', '1a', '2026-01-15', '2026-03-15', 'done',
           'All 1,346 STEDA-listed teachers invited and onboarded to Rumi',
           '≥80% teachers joined', '909 joined (68%)', 1),

          ('Phase 1B — Re-engagement Campaign', '1b', '2026-03-30', '2026-04-30', 'in_progress',
           'Personal re-engagement calls to the 437 non-joined teachers; reactivate lapsed users',
           '≥85% total join rate', NULL, 2),

          ('Call 1 — Online Training (April)', 'call1', '2026-04-02', '2026-04-02', 'upcoming',
           'Online group call with STEDA teachers; feature walkthroughs and Q&A',
           '≥300 teachers attend live', NULL, 3),

          ('Lesson Plan Deepening', 'lp', '2026-04-01', '2026-04-30', 'in_progress',
           'Drive LP usage to 95%+ completion; push multi-request depth',
           '≥600 LP teachers, 95% completion', '409 teachers, 98% completion', 4),

          ('Video Analysis Scale-up', 'video', '2026-04-01', '2026-04-30', 'in_progress',
           'Scale video analysis to ≥200 teachers with sustained completion',
           '≥200 video teachers, 80% completion', '37 teachers, 55% completion', 5),

          ('Coaching Rollout', 'coaching', '2026-04-15', '2026-05-31', 'upcoming',
           'Roll out AI coaching to ≥50 teachers; 1 master coach validated',
           '≥50 coaching teachers', '1 teacher piloting', 6),

          ('Community Building', 'community', '2026-03-01', '2026-04-30', 'in_progress',
           'Grow WhatsApp community to 700 members; consistent engagement',
           '≥700 members', '481 members', 7),

          ('Full Feature Depth (3+)', 'depth', '2026-04-01', '2026-05-31', 'upcoming',
           'Drive ≥30% of active users to use 3+ features',
           '≥30% depth-3 teachers', '6 teachers at depth 3 currently', 8),

          ('End-of-Pilot Report', 'report', '2026-05-31', '2026-05-31', 'upcoming',
           'Final fidelity report delivered to ED Rasool Bux and AD Mazhar Sherazi',
           'Report delivered on time', NULL, 9)
      `)
      console.log('Plan milestones seeded')
    } else {
      // Update existing milestone statuses based on PDF
      await client.query(`
        UPDATE plan_milestones SET status = 'done', actual_result = '909 joined (68%)'
        WHERE phase = '1a'
      `)
      await client.query(`
        UPDATE plan_milestones SET status = 'in_progress'
        WHERE phase = '1b'
      `)
      await client.query(`
        UPDATE plan_milestones SET status = 'in_progress', actual_result = '409 teachers, 98% completion'
        WHERE phase = 'lp'
      `)
      await client.query(`
        UPDATE plan_milestones SET status = 'in_progress', actual_result = '37 teachers, 55% completion'
        WHERE phase = 'video'
      `)
      await client.query(`
        UPDATE plan_milestones SET actual_result = '481 members'
        WHERE phase = 'community'
      `)
      console.log('Plan milestones updated')
    }

    // ── 5. Immediate action items from PDF ────────────────────────────────────
    // Check if standalone action items exist (no meeting_id)
    const { rows: existingActions } = await client.query(`
      SELECT count(*) FROM action_items WHERE meeting_id IS NULL
    `)
    if (parseInt(existingActions[0].count) === 0) {
      await client.query(`
        INSERT INTO action_items (text, owner, due_date, status, priority, category) VALUES
          ('Initiate personal re-engagement calls to 437 non-joined STEDA teachers',
           'Haroon / STEDA Team', '2026-04-15', 'open', 'high', 'onboarding'),

          ('Prepare and share Call 1 online training agenda with Junaid',
           'Haroon', '2026-04-01', 'open', 'high', 'training'),

          ('Host April 2 online group training call (feature walkthroughs + Q&A)',
           'Junaid / Rumi Team', '2026-04-02', 'open', 'high', 'training'),

          ('Identify and recruit 5 master coaches from current active teachers',
           'Haroon / STEDA', '2026-04-15', 'open', 'medium', 'coaching'),

          ('Share Rumi video analysis guide with 37 video users to improve completion from 55%',
           'Junaid', '2026-04-07', 'open', 'medium', 'video'),

          ('Add 200+ teachers to WhatsApp community (currently 481, target 700)',
           'Haroon / STEDA', '2026-04-30', 'open', 'medium', 'community'),

          ('Conduct follow-up with 482 depth-0 teachers who joined but never used a feature',
           'STEDA Field Team', '2026-04-20', 'open', 'high', 'engagement'),

          ('Validate coaching rubric with master coach pilot (1 teacher currently)',
           'Junaid', '2026-04-30', 'open', 'medium', 'coaching'),

          ('Prepare Phase 1B re-engagement script and calling guide for STEDA team',
           'Junaid', '2026-04-01', 'open', 'high', 'onboarding')
      `)
      console.log('Action items seeded from PDF')
    } else {
      console.log('Action items already exist, skipping')
    }

    console.log('\n✅ All done! Tracker database fully seeded.')
    console.log('   metric_snapshots: 1 row (2026-03-30)')
    console.log('   kpi_targets:      7 rows')
    console.log('   plan_milestones:  9 rows')
    console.log('   action_items:     9 rows (standalone, from PDF)')

  } catch (err) {
    console.error('Error:', err.message)
    console.error(err)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
