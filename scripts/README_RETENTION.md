# Video Retention Analysis Scripts

This analysis investigates the relationship between video generation feature usage and user retention.

## Quick Start

Run the complete analysis in two steps:

```bash
# Step 1: Extract data from database (one-time, ~2 min)
python scripts/retention_extract_data.py
# Creates: retention_data.json

# Step 2: Analyze and generate charts (fast, ~30 sec)
python scripts/retention_analyze.py
# Creates: retention_analysis_report.txt, retention_charts/
```

## Files

### Data Extraction
- **`retention_extract_data.py`** — Connects to database, runs 3 queries, saves JSON
  - Requires: `.env` with DB credentials using **port 6543** (transaction mode)
  - Output: `retention_data.json` (pre-aggregated, no secrets)
  - Queries: user segments, weekly activity, per-user stats
  - *Only needs to run once per data refresh*

### Analysis & Visualization
- **`retention_analyze.py`** — Works offline from `retention_data.json`
  - No database connection needed
  - Computes: retention curves, correlation stats, charts
  - Outputs:
    - `retention_analysis_report.txt` — Text report with all stats
    - `retention_charts/retention_curves.png` — Key visualization
    - `retention_charts/*.png` — 4 additional charts

### Documentation
- **`RETENTION_VIDEO_ANALYSIS_SUMMARY.md`** — Executive summary (root of project)
- **`retention_analysis_report.txt`** — Detailed numerical report
- **`README_RETENTION.md`** — This file

---

## Understanding the Output

### Retention Curves Chart
Shows week-over-week retention for each user segment:
- **LP → Video** (orange): users who used lesson plans first, then video. Highest retention (45% @ W1, 12% @ W8)
- **LP-Only** (blue): lesson plans only. Moderate retention (20% @ W1, 3% @ W8)
- **Video-Only** (green): video only. Similar to LP-only, small sample size (n=25)
- **Neither** (pink): neither feature. Baseline—lowest retention (12% @ W1, 0.5% @ W8)

### Active Days by Segment
Average user engagement depth by segment:
- **LP → Video:** 9.1 days (highest engagement)
- **LP + Video concurrent:** 9.6 days
- **LP-Only:** 2.9 days
- **Video-Only:** 2.8 days (similar to LP-only)
- **Neither:** 1.4 days (baseline)

### Video Usage vs Activity (Scatter + Trend)
Shows the correlation between having ever used video (0/1) and total active days:
- Clear upward trend (red dashed line, r=0.263)
- Video users cluster on the right with higher active days
- Trend is statistically significant (p<0.001)

---

## Key Statistics

| Metric | Value | Interpretation |
|--------|-------|-----------------|
| **r (correlation)** | 0.263 | Moderate positive correlation; video usage predicts engagement |
| **p-value** | 1.44e-93 | Essentially certain (not random chance) |
| **Video users (n)** | 117 | 2% of 5,877 users |
| **Non-video users (n)** | 5,760 | 98% of cohort |
| **Video avg days** | 7.8 | |
| **Non-video avg days** | 1.9 | |
| **Effect size** | +5.9 days (+312%) | Video users are ~4x more engaged |

---

## Data Freshness

- **Segment definition:** All users ever with completed video/lesson plan requests (no date filter)
- **Conversation activity:** All messages from any date (raw cumulative)
- **Extracted:** 2026-04-28
- **Next refresh:** Run `retention_extract_data.py` anytime; JSON includes `extracted_at` timestamp

To refresh:
```bash
rm retention_data.json
python scripts/retention_extract_data.py
python scripts/retention_analyze.py
```

---

## Technical Notes

### Why Two Scripts?

**Extract** (`retention_extract_data.py`) — *expensive, needs DB*
- 3 SQL queries, some with CTEs and joins
- Takes 1–2 minutes
- Saves intermediate JSON for offline reuse

**Analyze** (`retention_analyze.py`) — *fast, no DB needed*
- Pure Python + pandas + matplotlib
- ~30 seconds
- Useful for tweaking charts/formatting without re-querying

### Database Connection

Both scripts expect `.env` file with:
```
DB_HOST=aws-1-ap-southeast-1.pooler.supabase.com
DB_PORT=6543    # IMPORTANT: transaction mode (not 5432 session mode)
DB_NAME=postgres
DB_USER=...
DB_PASSWORD=...
DB_SSL=require
```

**Note:** Port 6543 is transaction-mode pooling with higher concurrency limits. Port 5432 (session mode) often exhausts pool capacity.

### Segment Logic

```python
CASE
  WHEN has_video AND NOT has_lp → 'video_only'
  WHEN has_video AND has_lp AND first_video > first_lp → 'lp_then_video'
  WHEN has_video AND has_lp AND first_video <= first_lp → 'video_and_lp_concurrent'
  WHEN has_lp AND NOT has_video → 'lp_only'
  ELSE 'neither'
END
```

"has_video" = at least 1 completed video_request  
"has_lp" = at least 1 completed lesson_plan_request

---

## Interpretation Guide

**Q: Is the correlation causal?**
A: No. The analysis shows correlation (video use ↔ high engagement), not causation. Possible explanations:
- Video is valuable and drives retention ✓
- Video attracts high-intent users who would stay anyway
- Users who stay longer are more likely to try video
- Selection bias (early adopters try video)

**Q: Why is video-only so small (n=25)?**
A: Video likely isn't discoverable without context. The 83 "LP → Video" users suggest video is a natural follow-up to lesson planning. Video-only users may have found it by accident or referral.

**Q: Should we expand video features?**
A: The data supports video as a value driver. However, look at actual usage metrics (completions, features used, support requests) alongside retention. High retention ≠ high satisfaction.

**Q: What's the "Neither" segment?**
A: 3,826 users (65%) never tried video or lesson plans. Most are inactive (1.4 days average). This is likely churn-by-non-engagement, not churn-from-video.

---

## Future Enhancements

Potential analyses to run:
- **Cohort by signup date** — Do recent cohorts show different video-adoption patterns?
- **By organization/partner** — Does video impact differ across STEDA vs Taleemabad vs others?
- **Time-to-video** — How long after signup do users try video? Correlation with retention?
- **Video feature depth** — Do users who complete multiple videos retain better than those with 1?
- **Churn prediction** — Can we flag at-risk users based on early feature usage?
- **LTV analysis** — What's the lifetime messaging volume for video-adopters vs control?

---

## Contact

For questions about methodology or findings, refer to:
- Executive summary: `RETENTION_VIDEO_ANALYSIS_SUMMARY.md`
- Full report: `retention_analysis_report.txt`
- Detailed output: `retention_charts/`
