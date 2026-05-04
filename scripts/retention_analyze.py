"""
Video Generation Feature Retention Analysis
==============================================
Analyzes user retention based on video generation feature usage:
1. Video-Only users
2. Lesson Plan → Video users (LP first, then Video)
3. Lesson Plan-Only users (control group)
4. Neither feature users (baseline)

Uses pre-extracted data from retention_data.json

Output: retention_analysis_report.txt  +  retention_charts/  +  console summary
"""

import os, sys, io, json, datetime, warnings
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns
from scipy.stats import pearsonr, ttest_ind

sns.set_theme(style="whitegrid", palette="Set2")
plt.rcParams.update({"figure.figsize": (13, 5), "figure.dpi": 150})

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
# 1. LOAD DATA
# ─────────────────────────────────────────────────────────────────────────────
log_report("=" * 80)
log_report("VIDEO GENERATION RETENTION ANALYSIS")
log_report("=" * 80)
log_report(f"Generated: {datetime.datetime.now().isoformat()}\n")

log_report("Step 1: Loading extracted data...")

with open('retention_data.json') as f:
    data = json.load(f)

segments_dict = data['segments']
activity_dict = data['activity']
stats_dict = data['stats']

log_report(f"Total segmented users: {len(segments_dict):,}\n")
log_report("Segment breakdown:")
for seg in ['video_only', 'lp_then_video', 'video_and_lp_concurrent', 'lp_only', 'neither']:
    count = sum(1 for v in segments_dict.values() if v == seg)
    pct = 100 * count / len(segments_dict)
    log_report(f"  {seg:30s}: {count:6,} ({pct:5.1f}%)")

# ─────────────────────────────────────────────────────────────────────────────
# 2. BUILD RETENTION MATRIX
# ─────────────────────────────────────────────────────────────────────────────
log_report("\nStep 2: Computing retention curves (weeks 0–8)...")

retention_by_week = []

for seg in ['video_only', 'lp_then_video', 'video_and_lp_concurrent', 'lp_only', 'neither']:
    # Get all users in this segment
    seg_users = {uid for uid, s in segments_dict.items() if s == seg}
    total_seg_users = len(seg_users)

    # For each user, find their first week
    user_first_week = {}
    for user_id in seg_users:
        if user_id in activity_dict:
            weeks = sorted(activity_dict[user_id])
            user_first_week[user_id] = weeks[0] if weeks else None
        else:
            user_first_week[user_id] = None

    # Compute week offsets for each user-week pair
    user_weeks = {}
    for user_id in seg_users:
        user_weeks[user_id] = set()

    for user_id, weeks in activity_dict.items():
        if user_id not in seg_users:
            continue

        first_week = user_first_week[user_id]
        if first_week is None:
            continue

        first_week_dt = pd.to_datetime(first_week)
        for week_str in weeks:
            week_dt = pd.to_datetime(week_str)
            week_offset = (week_dt - first_week_dt).days // 7
            user_weeks[user_id].add(week_offset)

    # For each week offset (0-8), count how many users are active
    for week_offset in range(0, 9):
        active_in_week = sum(1 for weeks in user_weeks.values() if week_offset in weeks)
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
log_report("-" * 80)
for seg in ['video_only', 'lp_then_video', 'video_and_lp_concurrent', 'lp_only', 'neither']:
    seg_ret = retention_df[retention_df['segment'] == seg]
    rates = [f"{seg}:"]
    for week in [0, 1, 2, 4, 8]:
        if week in seg_ret['week'].values:
            rate = seg_ret[seg_ret['week'] == week]['retention_rate'].values[0]
            rates.append(f"W{week}={rate:.1f}%")
    log_report("  " + "  ".join(rates))

# ─────────────────────────────────────────────────────────────────────────────
# 3. BUILD CORRELATION DATAFRAME
# ─────────────────────────────────────────────────────────────────────────────
log_report("\nStep 3: Building correlation data...")

# Convert stats to dataframe
correlation_data = []
for user_id, stats in stats_dict.items():
    correlation_data.append({
        'id': user_id,
        'active_days': stats['active_days'],
        'active_weeks': stats['active_weeks'],
        'used_video': stats['used_video'],
        'segment': stats['segment']
    })

correlation_df = pd.DataFrame(correlation_data)

log_report(f"Total users with activity data: {len(correlation_df):,}")

# ─────────────────────────────────────────────────────────────────────────────
# 4. COMPUTE SEGMENT STATISTICS
# ─────────────────────────────────────────────────────────────────────────────
log_report("\n" + "=" * 80)
log_report("SEGMENT STATISTICS")
log_report("=" * 80)

for seg in ['video_only', 'lp_then_video', 'video_and_lp_concurrent', 'lp_only', 'neither']:
    seg_data = correlation_df[correlation_df['segment'] == seg]

    if len(seg_data) == 0:
        continue

    log_report(f"\n{seg.upper()}")
    log_report("-" * 40)
    log_report(f"  Count: {len(seg_data):,} users")
    log_report(f"  Avg active days: {seg_data['active_days'].mean():.1f} (±{seg_data['active_days'].std():.1f})")
    log_report(f"  Avg active weeks: {seg_data['active_weeks'].mean():.1f} (±{seg_data['active_weeks'].std():.1f})")
    log_report(f"  Median active days: {seg_data['active_days'].median():.0f}")
    log_report(f"  Max active days: {seg_data['active_days'].max():.0f}")

# ─────────────────────────────────────────────────────────────────────────────
# 5. CORRELATION ANALYSIS
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
log_report(f"  Median active days: {video_users_data['active_days'].median():.0f}")

log_report(f"\nNon-Video Users (n={len(non_video_users_data):,}):")
log_report(f"  Mean active days: {non_video_users_data['active_days'].mean():.1f}")
log_report(f"  Mean active weeks: {non_video_users_data['active_weeks'].mean():.1f}")
log_report(f"  Median active days: {non_video_users_data['active_days'].median():.0f}")

# Pearson correlation: used_video (0/1) vs active_days
corr_r, corr_p = pearsonr(correlation_df['used_video'], correlation_df['active_days'])
log_report(f"\nPearson Correlation (video usage vs active days):")
log_report(f"  r = {corr_r:.4f}")
log_report(f"  p-value = {corr_p:.2e}")
if corr_p < 0.05:
    log_report(f"  *** SIGNIFICANT ***")
else:
    log_report(f"  (not significant)")

# T-test: video vs non-video on active_days
t_stat, t_p = ttest_ind(video_users_data['active_days'].fillna(0),
                         non_video_users_data['active_days'].fillna(0))
log_report(f"\nT-test (video users vs non-video, active days):")
log_report(f"  t = {t_stat:.4f}")
log_report(f"  p-value = {t_p:.2e}")
if t_p < 0.05:
    log_report(f"  *** SIGNIFICANT DIFFERENCE ***")
else:
    log_report(f"  (no significant difference)")

# ─────────────────────────────────────────────────────────────────────────────
# 6. CHARTS
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

# Chart 5: Distribution of active days by segment
fig, ax = plt.subplots(figsize=(12, 6))
segments_to_plot = ['video_only', 'lp_then_video', 'lp_only']
for seg in segments_to_plot:
    seg_data = correlation_df[correlation_df['segment'] == seg]['active_days']
    ax.hist(seg_data, alpha=0.6, label=f"{seg} (n={len(seg_data)})", bins=30)

ax.set_xlabel("Active Days", fontsize=12)
ax.set_ylabel("Count", fontsize=12)
ax.set_title("Distribution of Active Days by Segment", fontsize=14, fontweight='bold')
ax.legend()
ax.grid(True, alpha=0.3, axis='y')
path = save(fig, "active_days_distribution")
log_report(f"  Saved: {path}")

# ─────────────────────────────────────────────────────────────────────────────
# 7. SUMMARY
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

log_report(f"\n2. VIDEO USAGE IMPACT ON ACTIVITY")
video_mean = video_users_data['active_days'].mean()
non_video_mean = non_video_users_data['active_days'].mean()
diff = video_mean - non_video_mean
pct_change = 100 * diff / non_video_mean if non_video_mean > 0 else 0
log_report(f"   Video users average {video_mean:.1f} active days")
log_report(f"   Non-video users average {non_video_mean:.1f} active days")
log_report(f"   Difference: {diff:+.1f} days ({pct_change:+.1f}%)")

log_report(f"\n3. STATISTICAL SIGNIFICANCE")
if corr_p < 0.05:
    direction = "positive" if corr_r > 0 else "negative"
    log_report(f"   [YES] Video usage shows statistically significant {direction} correlation with retention")
    log_report(f"     Correlation coefficient r = {corr_r:.4f}, p-value = {corr_p:.2e}")
else:
    log_report(f"   [NO] Video usage does NOT show significant correlation with retention")
    log_report(f"     r = {corr_r:.4f}, p-value = {corr_p:.4f}")

if t_p < 0.05:
    log_report(f"   [YES] Video users differ significantly from non-video users (t-test p={t_p:.2e})")
else:
    log_report(f"   [NO] No significant difference between video and non-video users (p={t_p:.4f})")

log_report(f"\n4. SEGMENT BREAKDOWN")
log_report(f"   Video-only users: {(segments_dict.values().__class__.__name__)}")
for seg in ['video_only', 'lp_then_video', 'lp_only']:
    count = sum(1 for v in segments_dict.values() if v == seg)
    pct = 100 * count / len(segments_dict)
    mean_active = correlation_df[correlation_df['segment'] == seg]['active_days'].mean()
    log_report(f"     {seg:20s}: {count:6,} users ({pct:5.1f}%) — avg {mean_active:.1f} active days")

log_report("\n" + "=" * 80)
log_report("Analysis complete. Output:")
log_report(f"  Report: {REPORT_FILE}")
log_report(f"  Charts: {OUT}/")
log_report("=" * 80 + "\n")
