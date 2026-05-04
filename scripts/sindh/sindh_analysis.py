"""
Rumi Sindh Users - Detailed Data Analysis
==========================================
Identifies and analyses Sindh-based teachers using:
  1. Phone area codes  (landlines: 9221x=Karachi, 9222x=Hyderabad, etc.)
  2. School-name text matching for Sindh cities / keywords
  3. Combined "likely Sindh" flag

Run:  python sindh_analysis.py
Output: sindh_report.txt  +  sindh_users.xlsx
"""

import os, sys, datetime
from io import StringIO
from dotenv import load_dotenv
import pandas as pd
from sqlalchemy import create_engine, text

load_dotenv()

# ── Database ──────────────────────────────────────────────────────────────────
DB_URL = (
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    f"?sslmode={os.getenv('DB_SSL', 'require')}"
)


def get_engine():
    return create_engine(DB_URL, connect_args={"connect_timeout": 30})


def q(sql, **kw):
    with get_engine().connect() as c:
        return pd.read_sql(text(sql), c, params=kw)


# ── Sindh phone-prefix patterns ───────────────────────────────────────────────
# Pakistani landline area codes mapped to Sindh cities (in E.164 format)
SINDH_PHONE_PREFIXES = [
    ("9221", "Karachi"),
    ("9222", "Hyderabad"),
    ("9223", "Nawabshah/Shaheed Benazirabad"),
    ("9235", "Khairpur"),
    ("9241", "Jacobabad"),
    ("9242", "Shikarpur"),
    ("9243", "Larkana"),
    ("9244", "Kamber-Shahdadkot"),
    ("9251", "Sukkur"),
    ("9261", "Ghotki"),
    ("9291", "Mirpurkhas"),
    ("9292", "Sanghar"),
    ("9297", "Tharparkar/Mithi"),
    ("9298", "Umerkot"),
    ("9233", "Matiari"),
    ("9222", "Jamshoro"),
    ("9298", "Badin"),
    ("9292", "Thatta"),
]

# Sindh city/keyword list for school_name matching
SINDH_KEYWORDS = [
    "karachi", "hyderabad", "sukkur", "larkana", "nawabshah",
    "mirpurkhas", "khairpur", "jacobabad", "shikarpur", "ghotki",
    "dadu", "thatta", "badin", "sanghar", "tharparkar", "mithi",
    "umerkot", "matiari", "jamshoro", "kamber", "shahdadkot",
    "kotri", "clifton", "defence", "gulshan", "nazimabad",
    "saddar", "malir", "landhi", "korangi", "orangi", "baldia",
    "sindh", "sind",
]

# Build SQL ILIKE conditions for school_name
SCHOOL_LIKE_SQL = " OR ".join(
    f"LOWER(school_name) LIKE '%{kw}%'" for kw in SINDH_KEYWORDS
)

# Build SQL conditions for phone prefixes
PHONE_PREFIX_SQL = " OR ".join(
    f"phone_number LIKE '{pfx}%'" for pfx, _ in SINDH_PHONE_PREFIXES
)

SINDH_FILTER = f"(({PHONE_PREFIX_SQL}) OR ({SCHOOL_LIKE_SQL}))"


# ── Queries ───────────────────────────────────────────────────────────────────

def get_sindh_users():
    return q(f"""
        SELECT
            u.id,
            u.phone_number,
            u.first_name,
            u.last_name,
            u.school_name,
            u.grades_taught,
            u.subjects_taught,
            u.preferred_language,
            u.registration_completed,
            u.registration_state,
            u.portal_activated,
            u.created_at,
            u.updated_at
        FROM users u
        WHERE COALESCE(is_test_user, false) = false
          AND LEFT(phone_number, 2) = '92'
          AND {SINDH_FILTER}
        ORDER BY u.created_at DESC
    """)


def get_sindh_summary(sindh_ids_tuple):
    ids = sindh_ids_tuple
    return q(f"""
        SELECT
            COUNT(*)                                                          AS total_sindh_users,
            COUNT(*) FILTER (WHERE registration_completed)                    AS registered,
            COUNT(*) FILTER (WHERE NOT registration_completed)                AS unregistered,
            ROUND(100.0 * COUNT(*) FILTER (WHERE registration_completed)
                  / NULLIF(COUNT(*), 0), 1)                                   AS registration_rate_pct,
            COUNT(*) FILTER (WHERE preferred_language = 'ur')                 AS urdu_pref,
            COUNT(*) FILTER (WHERE preferred_language = 'en')                 AS english_pref,
            COUNT(*) FILTER (WHERE preferred_language = 'ar')                 AS arabic_pref,
            MIN(created_at)                                                   AS first_join,
            MAX(created_at)                                                   AS last_join
        FROM users
        WHERE id = ANY(ARRAY[{','.join(f"'{i}'" for i in ids)}]::uuid[])
    """)


def get_feature_usage(sindh_ids_tuple):
    ids = ",".join(f"'{i}'" for i in sindh_ids_tuple)
    return q(f"""
        SELECT
            'Lesson Plans (completed)'   AS feature,
            COUNT(*)                     AS count
        FROM lesson_plan_requests
        WHERE user_id = ANY(ARRAY[{ids}]::uuid[]) AND status = 'completed'
        UNION ALL
        SELECT 'Lesson Plans (all)', COUNT(*) FROM lesson_plan_requests
        WHERE user_id = ANY(ARRAY[{ids}]::uuid[])
        UNION ALL
        SELECT 'Coaching Sessions (completed)', COUNT(*) FROM coaching_sessions
        WHERE user_id = ANY(ARRAY[{ids}]::uuid[]) AND status = 'completed'
        UNION ALL
        SELECT 'Coaching Sessions (all)', COUNT(*) FROM coaching_sessions
        WHERE user_id = ANY(ARRAY[{ids}]::uuid[])
        UNION ALL
        SELECT 'Reading Assessments (completed)', COUNT(*) FROM reading_assessments
        WHERE user_id = ANY(ARRAY[{ids}]::uuid[]) AND status = 'completed'
        UNION ALL
        SELECT 'Reading Assessments (all)', COUNT(*) FROM reading_assessments
        WHERE user_id = ANY(ARRAY[{ids}]::uuid[])
        UNION ALL
        SELECT 'Video Requests (completed)', COUNT(*) FROM video_requests
        WHERE user_id = ANY(ARRAY[{ids}]::uuid[]) AND status = 'completed'
        UNION ALL
        SELECT 'Image Analysis (completed)', COUNT(*) FROM image_analysis_requests
        WHERE user_id = ANY(ARRAY[{ids}]::uuid[]) AND status = 'completed'
        ORDER BY count DESC
    """)


def get_engagement(sindh_ids_tuple):
    ids = ",".join(f"'{i}'" for i in sindh_ids_tuple)
    return q(f"""
        SELECT
            COUNT(*)                                          AS total_messages,
            COUNT(DISTINCT user_id)                           AS active_users,
            COUNT(*) FILTER (WHERE message_type = 'voice')   AS voice_messages,
            COUNT(*) FILTER (WHERE message_type = 'image')   AS image_messages,
            COUNT(*) FILTER (WHERE message_type = 'text')    AS text_messages,
            ROUND(100.0 * COUNT(*) FILTER (WHERE message_type = 'voice')
                  / NULLIF(COUNT(*), 0), 1)                   AS voice_pct
        FROM conversations
        WHERE user_id = ANY(ARRAY[{ids}]::uuid[])
          AND role = 'user'
    """)


def get_monthly_growth(sindh_ids_tuple):
    ids = ",".join(f"'{i}'" for i in sindh_ids_tuple)
    return q(f"""
        SELECT
            TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
            COUNT(*)                                              AS new_users,
            COUNT(*) FILTER (WHERE registration_completed)        AS registered
        FROM users
        WHERE id = ANY(ARRAY[{ids}]::uuid[])
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
    """)


def get_top_schools(sindh_ids_tuple):
    ids = ",".join(f"'{i}'" for i in sindh_ids_tuple)
    return q(f"""
        SELECT
            school_name,
            COUNT(*)  AS teacher_count,
            COUNT(*) FILTER (WHERE registration_completed)  AS registered
        FROM users
        WHERE id = ANY(ARRAY[{ids}]::uuid[])
          AND school_name IS NOT NULL AND school_name <> ''
        GROUP BY school_name
        ORDER BY teacher_count DESC
        LIMIT 30
    """)


def get_grades_distribution(sindh_ids_tuple):
    ids = ",".join(f"'{i}'" for i in sindh_ids_tuple)
    return q(f"""
        SELECT grades_taught, COUNT(*) AS users
        FROM users
        WHERE id = ANY(ARRAY[{ids}]::uuid[])
          AND grades_taught IS NOT NULL AND grades_taught <> ''
        GROUP BY grades_taught
        ORDER BY users DESC
        LIMIT 20
    """)


def get_power_users(sindh_ids_tuple):
    ids = ",".join(f"'{i}'" for i in sindh_ids_tuple)
    return q(f"""
        SELECT
            u.phone_number,
            u.first_name,
            u.school_name,
            u.grades_taught,
            u.preferred_language,
            u.created_at::date         AS joined,
            (SELECT COUNT(*) FROM lesson_plan_requests l WHERE l.user_id = u.id AND l.status='completed') AS lesson_plans,
            (SELECT COUNT(*) FROM coaching_sessions    c WHERE c.user_id = u.id AND c.status='completed') AS coaching,
            (SELECT COUNT(*) FROM reading_assessments  r WHERE r.user_id = u.id AND r.status='completed') AS reading,
            (SELECT COUNT(*) FROM image_analysis_requests i WHERE i.user_id = u.id AND i.status='completed') AS images,
            (SELECT COUNT(*) FROM conversations        v WHERE v.user_id = u.id AND v.role='user') AS total_messages
        FROM users u
        WHERE u.id = ANY(ARRAY[{ids}]::uuid[])
          AND u.registration_completed = true
        ORDER BY
            (SELECT COUNT(*) FROM lesson_plan_requests l WHERE l.user_id = u.id) +
            (SELECT COUNT(*) FROM coaching_sessions    c WHERE c.user_id = u.id) +
            (SELECT COUNT(*) FROM reading_assessments  r WHERE r.user_id = u.id) DESC
        LIMIT 20
    """)


def get_reading_benchmarks(sindh_ids_tuple):
    ids = ",".join(f"'{i}'" for i in sindh_ids_tuple)
    return q(f"""
        SELECT
            language,
            grade_level,
            COUNT(*)                                                             AS assessments,
            ROUND(AVG(wcpm)::numeric, 1)                                         AS avg_wcpm,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY wcpm)::numeric, 1) AS median_wcpm,
            ROUND(AVG(accuracy_percentage)::numeric, 1)                          AS avg_accuracy_pct,
            COUNT(*) FILTER (WHERE on_track = true)                              AS on_track_count,
            COUNT(*) FILTER (WHERE on_track = false)                             AS below_track_count,
            ROUND(100.0 * COUNT(*) FILTER (WHERE on_track = true)
                  / NULLIF(COUNT(*), 0), 1)                                      AS on_track_pct
        FROM reading_assessments
        WHERE user_id = ANY(ARRAY[{ids}]::uuid[])
          AND status = 'completed' AND wcpm IS NOT NULL
        GROUP BY language, grade_level
        ORDER BY language, grade_level
    """)


# ── Report builder ────────────────────────────────────────────────────────────

def section(title, df=None, text=None):
    lines = [f"\n{'='*70}", f"  {title}", f"{'='*70}"]
    if text:
        lines.append(text)
    if df is not None and not df.empty:
        lines.append(df.to_string(index=False))
    elif df is not None and df.empty:
        lines.append("  (no data)")
    return "\n".join(lines)


def run():
    print("Connecting to Rumi database …")

    # 1. Fetch Sindh users
    print("Fetching Sindh users …")
    users = get_sindh_users()
    if users.empty:
        print("No Sindh users found with current filters.")
        sys.exit(1)

    print(f"Found {len(users):,} likely-Sindh users.")
    ids = tuple(str(i) for i in users["id"].tolist())

    # 2. Run all analyses
    print("Running analysis queries …")
    summary   = get_sindh_summary(ids)
    features  = get_feature_usage(ids)
    engage    = get_engagement(ids)
    growth    = get_monthly_growth(ids)
    schools   = get_top_schools(ids)
    grades    = get_grades_distribution(ids)
    power     = get_power_users(ids)
    reading   = get_reading_benchmarks(ids)

    # 3. Build report text
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M UTC")
    report_lines = [
        "RUMI – SINDH USERS DETAILED ANALYSIS REPORT",
        f"Generated: {ts}",
        f"Identification method: Phone area codes (landline 9221x–9298x) + school name keywords",
        f"Total likely-Sindh users identified: {len(users):,}",
        "Note: Mobile phone numbers do not carry provincial info; school-name matching may",
        "      over/under-count — treat figures as best-available estimates.",
    ]

    # Summary
    if not summary.empty:
        s = summary.iloc[0]
        report_lines.append(section("1. HIGH-LEVEL SUMMARY", text=f"""
  Total Sindh users (estimated)  : {int(s.get('total_sindh_users', 0)):,}
  Registered (completed)         : {int(s.get('registered', 0)):,}  ({s.get('registration_rate_pct', 0):.1f}%)
  Unregistered                   : {int(s.get('unregistered', 0)):,}
  Language preference – Urdu     : {int(s.get('urdu_pref', 0)):,}
  Language preference – English  : {int(s.get('english_pref', 0)):,}
  Language preference – Arabic   : {int(s.get('arabic_pref', 0)):,}
  First user joined              : {str(s.get('first_join', 'N/A'))[:10]}
  Latest user joined             : {str(s.get('last_join', 'N/A'))[:10]}"""))

    # Engagement
    if not engage.empty:
        e = engage.iloc[0]
        report_lines.append(section("2. MESSAGING ENGAGEMENT", text=f"""
  Total messages sent by users   : {int(e.get('total_messages', 0)):,}
  Unique users who messaged      : {int(e.get('active_users', 0)):,}
  Text messages                  : {int(e.get('text_messages', 0)):,}
  Voice messages                 : {int(e.get('voice_messages', 0)):,}  ({e.get('voice_pct', 0):.1f}% of total)
  Image messages                 : {int(e.get('image_messages', 0)):,}"""))

    # Feature usage
    report_lines.append(section("3. FEATURE USAGE", df=features))

    # Reading benchmarks
    if not reading.empty:
        report_lines.append(section("4. READING ASSESSMENT BENCHMARKS", df=reading))

    # Monthly growth
    report_lines.append(section("5. MONTHLY USER GROWTH", df=growth))

    # Top schools
    report_lines.append(section("6. TOP SCHOOLS / INSTITUTIONS", df=schools))

    # Grade distribution
    report_lines.append(section("7. GRADES TAUGHT DISTRIBUTION", df=grades))

    # Power users
    report_lines.append(section("8. TOP 20 POWER USERS (by feature usage)", df=power))

    # Full user list summary
    reg_pct = (users["registration_completed"].sum() / len(users) * 100) if len(users) else 0
    lang_counts = users["preferred_language"].value_counts().to_dict()
    report_lines.append(section("9. LANGUAGE BREAKDOWN (from user list)", text="\n  " + "\n  ".join(
        f"{lang or 'unknown'}: {cnt}" for lang, cnt in lang_counts.items()
    )))

    # Finalize
    full_report = "\n".join(report_lines)

    # Save report
    report_path = "sindh_report.txt"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(full_report)
    print(f"\nReport saved → {report_path}")

    # Save Excel
    excel_path = "sindh_users.xlsx"
    with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
        users.drop(columns=["id"], errors="ignore").to_excel(writer, sheet_name="Sindh Users", index=False)
        summary.to_excel(writer, sheet_name="Summary", index=False)
        features.to_excel(writer, sheet_name="Feature Usage", index=False)
        engage.to_excel(writer, sheet_name="Engagement", index=False)
        growth.to_excel(writer, sheet_name="Monthly Growth", index=False)
        schools.to_excel(writer, sheet_name="Top Schools", index=False)
        grades.to_excel(writer, sheet_name="Grades", index=False)
        power.to_excel(writer, sheet_name="Power Users", index=False)
        if not reading.empty:
            reading.to_excel(writer, sheet_name="Reading Benchmarks", index=False)
    print(f"Excel saved   → {excel_path}")

    # Print to console
    print("\n" + full_report)


if __name__ == "__main__":
    run()
