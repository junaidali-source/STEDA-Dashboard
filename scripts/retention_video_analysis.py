"""
Video Generation Feature Retention Analysis
==============================================
Analyzes user retention based on video generation feature usage:
1. Video-Only users
2. Lesson Plan → Video users (LP first, then Video)
3. Lesson Plan-Only users (control group)
4. Neither feature users (baseline)

Measures:
- Week-over-week cohort retention (weeks 0–8)
- Correlation between video usage and active days
- Per-segment statistics

Output: retention_analysis_report.txt  +  retention_charts/  +  console summary
"""

import os, sys, io, datetime, warnings
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns
from scipy import stats
from dotenv import load_dotenv
import psycopg2

load_dotenv()

sns.set_theme(style="whitegrid", palette="Set2")
plt.rcParams.update({"figure.figsize": (13, 5), "figure.dpi": 150})

# ── DB ────────────────────────────────────────────────────────────────────────
conn = psycopg2.connect(
    host=os.getenv('DB_HOST'),
    port=int(os.getenv('DB_PORT', '5432')),
    database=os.getenv('DB_NAME'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    sslmode='require'
)

def q(sql, **params):
    return pd.read_sql(sql, conn, params=params or None)

# ── Output dir ────────────────────────────────────────────────────────────────
OUT = "retention_charts"
os.makedirs(OUT, exist_ok=True)
REPORT_FILE = "retention_analysis_report.txt"

def save(fig, name):
    path = f"{OUT}/{name}.png"
    fig.savefig(path, bbox_inches="tight", dpi=150)
    plt.close(fig)
    return path

def log_report(msg):
    """Print to console and write to report file."""
    print(msg)
    with open(REPORT_FILE, "a") as f:
        f.write(msg + "\n")

# Clear report file
open(REPORT_FILE, "w").close()

# ─────────────────────────────────────────────────────────────────────────────
# 1. FETCH & SEGMENT USERS
# ─────────────────────────────────────────────────────────────────────────────
log_report("=" * 80)
log_report("VIDEO GENERATION RETENTION ANALYSIS")
log_report("=" * 80)
log_report(f"Generated: {datetime.datetime.now().isoformat()}\n")

log_report("Step 1: Segmenting users by video + lesson plan usage...")

# Segment users
segments_df = q("""
WITH video_users AS (
  SELECT DISTINCT user_id FROM video_requests WHERE status = 'completed'
),
lp_users AS (
  SELECT DISTINCT user_id FROM lesson_plan_requests WHERE status = 'completed'
),
first_video AS (
  SELECT user_id, MIN(created_at) AS first_video_at FROM video_requests WHERE status='completed' GROUP BY user_id
),
first_lp AS (
  SELECT user_id, MIN(created_at) AS first_lp_at FROM lesson_plan_requests WHERE status='completed' GROUP BY user_id
)
SELECT
  u.id,
  CASE
    WHEN v.user_id IS NOT NULL AND lp.user_id IS NULL THEN 'video_only'
    WHEN v.user_id IS NOT NULL AND lp.user_id IS NOT NULL AND fv.first_video_at > flp.first_lp_at THEN 'lp_then_video'
    WHEN v.user_id IS NOT NULL AND lp.user_id IS NOT NULL THEN 'video_and_lp_concurrent'
    WHEN lp.user_id IS NOT NULL AND v.user_id IS NULL THEN 'lp_only'
    ELSE 'neither'
  END AS segment
FROM users u
LEFT JOIN video_users v ON v.user_id = u.id
LEFT JOIN lp_users lp ON lp.user_id = u.id
LEFT JOIN first_video fv ON fv.user_id = u.id
LEFT JOIN first_lp flp ON flp.user_id = u.id
WHERE COALESCE(u.is_test_user, false) = false
""")

log_report(f"Total segmented users: {len(segments_df):,}\n")
log_report("Segment breakdown:")
for seg in ['video_only', 'lp_then_video', 'video_and_lp_concurrent', 'lp_only', 'neither']:
    count = (segments_df['segment'] == seg).sum()
    pct = 100 * count / len(segments_df)
    log_report(f"  {seg:30s}: {count:6,} ({pct:5.1f}%)")

# ─────────────────────────────────────────────────────────────────────────────
# 2. FETCH WEEKLY ACTIVITY
# ─────────────────────────────────────────────────────────────────────────────
log_report("\nStep 2: Fetching weekly activity...")

activity_df = q("""
SELECT c.user_id,
       DATE_TRUNC('week', c.created_at)::date AS activity_week
FROM conversations c
JOIN users u ON u.id = c.user_id
WHERE c.role = 'user'
  AND COALESCE(u.is_test_user, false) = false
GROUP BY c.user_id, DATE_TRUNC('week', c.created_at)
""")

log_report(f"Total user-week records: {len(activity_df):,}")

# ─────────────────────────────────────────────────────────────────────────────
# 3. COMPUTE RETENTION CURVES
# ─────────────────────────────────────────────────────────────────────────────
log_report("\nStep 3: Computing retention curves (weeks 0–8)...")

# Merge activity with segments
activity_df = activity_df.merge(segments_df[['id', 'segment']], left_on='user_id', right_on='id', how='left')

# Find first week for each user
first_week = activity_df.groupby('user_id')['activity_week'].min().reset_index()
first_week.columns = ['user_id', 'first_week']

activity_df = activity_df.merge(first_week, on='user_id', how='left')

# Compute week offset
activity_df['week_offset'] = (activity_df['activity_week'] - activity_df['first_week']).dt.days // 7

# Build retention matrix: for each segment, week offset → % retained
retention_by_week = []

for seg in ['video_only', 'lp_then_video', 'video_and_lp_concurrent', 'lp_only', 'neither']:
    seg_users = segments_df[segments_df['segment'] == seg]['id'].unique()
    seg_activity = activity_df[activity_df['user_id'].isin(seg_users)]

    # Total unique users in segment
    total_seg_users = len(seg_users)

    for week_offset in range(0, 9):
        # Count users active in this week offset
        active_in_week = len(seg_activity[seg_activity['week_offset'] == week_offset]['user_id'].unique())
        retention_rate = 100 * active_in_week / total_seg_users if total_seg_users > 0 else 0

        retention_by_week.append({
            'segment': seg,
            'week': week_offset,
            'retention_rate': retention_rate,
            'active_users': active_in_week,
            'total_users': total_seg_users
        })

retention_df = pd.DataFrame(retention_by_week)

log_report("\nRetention Rates by Segment and Week:")
log_report("─" * 80)
for seg in ['video_only', 'lp_then_video', 'video_and_lp_concurrent', 'lp_only', 'neither']:
    seg_ret = retention_df[retention_df['segment'] == seg]
    rates = [f"{seg}:"]
    for week in [0, 1, 2, 4, 8]:
        if week in seg_ret['week'].values:
            rate = seg_ret[seg_ret['week'] == week]['retention_rate'].values[0]
            rates.append(f"W{week}={rate:.1f}%")
    log_report("  " + "  ".join(rates))

# ─────────────────────────────────────────────────────────────────────────────
# 4. FETCH CORRELATION DATA
# ─────────────────────────────────────────────────────────────────────────────
log_report("\nStep 4: Fetching correlation data...")

correlation_df = q("""
SELECT u.id,
       COUNT(DISTINCT c.created_at::date) AS active_days,
       COUNT(DISTINCT DATE_TRUNC('week', c.created_at)) AS active_weeks,
       CASE WHEN v.user_id IS NOT NULL THEN 1 ELSE 0 END AS used_video
FROM users u
LEFT JOIN conversations c ON c.user_id = u.id AND c.role = 'user'
LEFT JOIN (SELECT DISTINCT user_id FROM video_requests WHERE status='completed') v ON v.user_id = u.id
WHERE COALESCE(u.is_test_user, false) = false
GROUP BY u.id, v.user_id
""")

# Merge with segments for summary stats
correlation_df = correlation_df.merge(segments_df[['id', 'segment']], left_on='id', right_on='id', how='left')

log_report(f"Total users with activity data: {len(correlation_df):,}")

# ─────────────────────────────────────────────────────────────────────────────
# 5. COMPUTE SEGMENT STATISTICS
# ─────────────────────────────────────────────────────────────────────────────
log_report("\n" + "=" * 80)
log_report("SEGMENT STATISTICS")
log_report("=" * 80)

for seg in ['video_only', 'lp_then_video', 'video_and_lp_concurrent', 'lp_only', 'neither']:
    seg_data = correlation_df[correlation_df['segment'] == seg]

    if len(seg_data) == 0:
        continue

    log_report(f"\n{seg.upper()}")
    log_report("─" * 40)
    log_report(f"  Count: {len(seg_data):,} users")
    log_report(f"  Avg active days: {seg_data['active_days'].mean():.1f} (±{seg_data['active_days'].std():.1f})")
    log_report(f"  Avg active weeks: {seg_data['active_weeks'].mean():.1f} (±{seg_data['active_weeks'].std():.1f})")
    log_report(f"  Median active days: {seg_data['active_days'].median():.0f}")
    log_report(f"  Max active days: {seg_data['active_days'].max():.0f}")

# ─────────────────────────────────────────────────────────────────────────────
# 6. CORRELATION ANALYSIS
# ─────────────────────────────────────────────────────────────────────────────
log_report("\n" + "=" * 80)
log_report("CORRELATION: VIDEO USAGE vs RETENTION")
log_report("=" * 80)

# Compare video users vs non-video
video_users_data = correlation_df[correlation_df['used_video'] == 1]
non_video_users_data = correlation_df[correlation_df['used_video'] == 0]

log_report(f"\nVideo Users (n={len(video_users_data):,}):")
log_report(f"  Mean active days: {video_users_data['active_days'].mean():.1f}")
log_report(f"  Mean active weeks: {video_users_data['active_weeks'].mean():.1f}")

log_report(f"\nNon-Video Users (n={len(non_video_users_data):,}):")
log_report(f"  Mean active days: {non_video_users_data['active_days'].mean():.1f}")
log_report(f"  Mean active weeks: {non_video_users_data['active_weeks'].mean():.1f}")

# Pearson correlation: used_video (0/1) vs active_days
corr_r, corr_p = stats.pearsonr(correlation_df['used_video'], correlation_df['active_days'])
log_report(f"\nPearson Correlation (video usage vs active days):")
log_report(f"  r = {corr_r:.4f}")
log_report(f"  p-value = {corr_p:.2e}")
if corr_p < 0.05:
    log_report(f"  *** SIGNIFICANT ***")
else:
    log_report(f"  (not significant)")

# T-test: video vs non-video on active_days
t_stat, t_p = stats.ttest_ind(video_users_data['active_days'].fillna(0),
                                non_video_users_data['active_days'].fillna(0))
log_report(f"\nT-test (video users vs non-video, active days):")
log_report(f"  t = {t_stat:.4f}")
log_report(f"  p-value = {t_p:.2e}")
if t_p < 0.05:
    log_report(f"  *** SIGNIFICANT DIFFERENCE ***")
else:
    log_report(f"  (no significant difference)")

# ─────────────────────────────────────────────────────────────────────────────
# 7. CHARTS
# ─────────────────────────────────────────────────────────────────────────────
log_report("\n" + "=" * 80)
log_report("GENERATING CHARTS")
log_report("=" * 80)

# Chart 1: Retention curves
fig, ax = plt.subplots(figsize=(12, 6))
for seg in ['video_only', 'lp_then_video', 'lp_only', 'neither']:
    seg_ret = retention_df[retention_df['segment'] == seg].sort_values('week')
    ax.plot(seg_ret['week'], seg_ret['retention_rate'], marker='o', label=seg, linewidth=2)

ax.set_xlabel("Week Offset", fontsize=12)
ax.set_ylabel("Retention Rate (%)", fontsize=12)
ax.set_title("User Retention by Feature Usage Segment", fontsize=14, fontweight='bold')
ax.legend(loc='best')
ax.grid(True, alpha=0.3)
ax.set_ylim(0, 105)
path = save(fig, "retention_curves")
log_report(f"  Saved: {path}")

# Chart 2: Mean active days by segment
fig, ax = plt.subplots(figsize=(10, 6))
seg_stats = correlation_df.groupby('segment')['active_days'].mean().sort_values(ascending=False)
bars = ax.bar(range(len(seg_stats)), seg_stats.values, color=sns.color_palette("Set2", len(seg_stats)))
ax.set_xticks(range(len(seg_stats)))
ax.set_xticklabels(seg_stats.index, rotation=45, ha='right')
ax.set_ylabel("Mean Active Days", fontsize=12)
ax.set_title("Average User Activity Days by Segment", fontsize=14, fontweight='bold')
for i, (seg, val) in enumerate(seg_stats.items()):
    ax.text(i, val + 1, f"{val:.1f}", ha='center', va='bottom', fontsize=10)
ax.grid(True, alpha=0.3, axis='y')
path = save(fig, "active_days_by_segment")
log_report(f"  Saved: {path}")

# Chart 3: Scatter + regression: video usage vs active days
fig, ax = plt.subplots(figsize=(10, 6))
# Jitter for visualization
jitter = np.random.normal(0, 0.02, len(correlation_df))
ax.scatter(correlation_df['used_video'] + jitter, correlation_df['active_days'],
           alpha=0.3, s=20, color='steelblue')

# Regression line
z = np.polyfit(correlation_df['used_video'], correlation_df['active_days'], 1)
p = np.poly1d(z)
ax.plot([0, 1], [p(0), p(1)], "r--", linewidth=2, label=f'Trend (r={corr_r:.3f})')

ax.set_xlabel("Used Video Generation (0=No, 1=Yes)", fontsize=12)
ax.set_ylabel("Active Days", fontsize=12)
ax.set_title(f"Video Usage vs User Activity (n={len(correlation_df):,})", fontsize=14, fontweight='bold')
ax.set_xticks([0, 1])
ax.legend()
ax.grid(True, alpha=0.3)
path = save(fig, "video_vs_activity")
log_report(f"  Saved: {path}")

# Chart 4: Active weeks by segment
fig, ax = plt.subplots(figsize=(10, 6))
seg_stats = correlation_df.groupby('segment')['active_weeks'].mean().sort_values(ascending=False)
bars = ax.bar(range(len(seg_stats)), seg_stats.values, color=sns.color_palette("Set2", len(seg_stats)))
ax.set_xticks(range(len(seg_stats)))
ax.set_xticklabels(seg_stats.index, rotation=45, ha='right')
ax.set_ylabel("Mean Active Weeks", fontsize=12)
ax.set_title("Average User Activity Weeks by Segment", fontsize=14, fontweight='bold')
for i, (seg, val) in enumerate(seg_stats.items()):
    ax.text(i, val + 0.2, f"{val:.1f}", ha='center', va='bottom', fontsize=10)
ax.grid(True, alpha=0.3, axis='y')
path = save(fig, "active_weeks_by_segment")
log_report(f"  Saved: {path}")

# ─────────────────────────────────────────────────────────────────────────────
# 8. SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
log_report("\n" + "=" * 80)
log_report("SUMMARY & CONCLUSIONS")
log_report("=" * 80)

# Key insights
log_report(f"\n1. RETENTION COMPARISON")
for week in [1, 2, 4, 8]:
    log_report(f"\n   Week {week}:")
    for seg in ['video_only', 'lp_then_video', 'lp_only']:
        ret = retention_df[(retention_df['segment'] == seg) & (retention_df['week'] == week)]
        if len(ret) > 0:
            rate = ret['retention_rate'].values[0]
            log_report(f"     {seg:20s}: {rate:5.1f}%")

log_report(f"\n2. VIDEO USAGE IMPACT")
video_mean = video_users_data['active_days'].mean()
non_video_mean = non_video_users_data['active_days'].mean()
diff = video_mean - non_video_mean
pct_change = 100 * diff / non_video_mean if non_video_mean > 0 else 0
log_report(f"   Video users average {video_mean:.1f} active days")
log_report(f"   Non-video users average {non_video_mean:.1f} active days")
log_report(f"   Difference: {diff:+.1f} days ({pct_change:+.1f}%)")

log_report(f"\n3. STATISTICAL SIGNIFICANCE")
if corr_p < 0.05:
    log_report(f"   Video usage shows statistically significant correlation with retention (p={corr_p:.2e})")
else:
    log_report(f"   Video usage does NOT show significant correlation with retention (p={corr_p:.4f})")

log_report(f"\n4. SEGMENT INSIGHTS")
log_report(f"   Video-only users: {(segments_df['segment'] == 'video_only').sum():,} users")
log_report(f"   LP→Video progression: {(segments_df['segment'] == 'lp_then_video').sum():,} users")
log_report(f"   LP-only (control): {(segments_df['segment'] == 'lp_only').sum():,} users")

log_report("\n" + "=" * 80)
log_report("Analysis complete. Output:")
log_report(f"  Report: {REPORT_FILE}")
log_report(f"  Charts: {OUT}/")
log_report("=" * 80 + "\n")
