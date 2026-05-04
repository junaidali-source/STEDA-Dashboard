"""
Extract retention data for offline analysis.
Runs minimal queries with a single persistent connection.
"""

import os, sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from dotenv import load_dotenv
import psycopg2
from datetime import datetime

load_dotenv()

print("Connecting to database (transaction mode port 6543)...")
conn = psycopg2.connect(
    host=os.getenv('DB_HOST'),
    port=6543,  # Transaction mode (not session mode 5432)
    database=os.getenv('DB_NAME'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    sslmode='require'
)

cur = conn.cursor()

# 1. Segment users
print("Extracting user segments...")
cur.execute("""
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
  u.id::text,
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

segments = {}
for row in cur.fetchall():
    user_id, segment = row
    segments[user_id] = segment

print(f"  Total users: {len(segments)}")
for seg in ['video_only', 'lp_then_video', 'video_and_lp_concurrent', 'lp_only', 'neither']:
    count = sum(1 for v in segments.values() if v == seg)
    print(f"    {seg}: {count:,}")

# 2. Weekly activity
print("\nExtracting weekly activity...")
cur.execute("""
SELECT c.user_id::text,
       DATE_TRUNC('week', c.created_at)::date AS activity_week
FROM conversations c
JOIN users u ON u.id = c.user_id
WHERE c.role = 'user'
  AND COALESCE(u.is_test_user, false) = false
GROUP BY c.user_id, DATE_TRUNC('week', c.created_at)
ORDER BY c.user_id, activity_week
""")

activity = {}
for row in cur.fetchall():
    user_id, week = row
    week_str = week.isoformat()
    if user_id not in activity:
        activity[user_id] = []
    activity[user_id].append(week_str)

print(f"  Users with activity: {len(activity):,}")

# 3. Per-user stats
print("\nExtracting per-user statistics...")
cur.execute("""
SELECT u.id::text,
       COUNT(DISTINCT c.created_at::date) AS active_days,
       COUNT(DISTINCT DATE_TRUNC('week', c.created_at)::date) AS active_weeks,
       CASE WHEN v.user_id IS NOT NULL THEN 1 ELSE 0 END AS used_video
FROM users u
LEFT JOIN conversations c ON c.user_id = u.id AND c.role = 'user'
LEFT JOIN (SELECT DISTINCT user_id FROM video_requests WHERE status='completed') v ON v.user_id = u.id
WHERE COALESCE(u.is_test_user, false) = false
GROUP BY u.id, v.user_id
ORDER BY u.id
""")

stats_data = {}
for row in cur.fetchall():
    user_id, active_days, active_weeks, used_video = row
    if active_days is None:
        active_days = 0
    if active_weeks is None:
        active_weeks = 0
    stats_data[user_id] = {
        'active_days': int(active_days),
        'active_weeks': int(active_weeks),
        'used_video': int(used_video),
        'segment': segments.get(user_id, 'unknown')
    }

print(f"  Users with stats: {len(stats_data):,}")

conn.close()

# Save to JSON
print("\nSaving data...")
with open('retention_data.json', 'w') as f:
    json.dump({
        'segments': segments,
        'activity': activity,
        'stats': stats_data,
        'extracted_at': datetime.now().isoformat()
    }, f, indent=2)

print("✓ Data saved to retention_data.json")
