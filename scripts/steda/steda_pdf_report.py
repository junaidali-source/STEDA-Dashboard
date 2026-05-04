"""
STEDA Partner — Engagement & Coaching Report
=============================================
Generates steda_report.pdf covering all 176 STEDA teachers:
  activation, engagement, retention, feature discovery,
  coaching observations (March 10 – April 14 2026).

Usage:
    cd "Rumi Data analysis new"
    python scripts/steda/steda_pdf_report.py
"""

import os, sys, io, csv, datetime, pathlib, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import psycopg2
import psycopg2.extras

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether,
)
from reportlab.pdfgen import canvas as pdfcanvas

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = pathlib.Path(__file__).parent
ROOT        = SCRIPT_DIR.parent.parent
CSV_PATH    = ROOT / "rumi-dashboard" / "data" / "STEDA List of Teachers-1 .csv"
ENV_PATH    = ROOT / "rumi-dashboard" / ".env.local"
OUT_PDF     = SCRIPT_DIR / "steda_report.pdf"

# ── DB connection ─────────────────────────────────────────────────────────────
def load_env(path):
    env = {}
    try:
        for line in pathlib.Path(path).read_text(encoding="utf-8").splitlines():
            m = re.match(r'^([^#=\s]+)\s*=\s*(.*)$', line)
            if m:
                env[m.group(1)] = m.group(2).strip().strip('"\'')
    except Exception:
        pass
    return env

_env = load_env(ENV_PATH)

def get_conn():
    # Force port 6543 (transaction-mode pooler) — session-mode (5432) hits MaxClients
    host = _env.get("DB_HOST", "aws-1-ap-southeast-1.pooler.supabase.com")
    # Swap session pooler port 5432 → transaction pooler port 6543
    port_env = int(_env.get("DB_PORT", "6543"))
    port = 6543 if port_env == 5432 else port_env
    return psycopg2.connect(
        host     = host,
        port     = port,
        dbname   = _env.get("DB_NAME", "postgres"),
        user     = _env.get("DB_USER", ""),
        password = _env.get("DB_PASSWORD", ""),
        sslmode  = "require",
        connect_timeout = 15,
    )

def q(conn, sql, params=()):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        return cur.fetchall()

# ── CSV helpers ───────────────────────────────────────────────────────────────
def norm_phone(raw: str) -> str | None:
    """Mirror the TypeScript normPhone() in steda-phones.ts exactly."""
    p = re.sub(r'[\s\-\(\)]', '', raw or '')
    if not p:
        return None
    if p.startswith('0'):
        return '92' + p[1:]
    if p.startswith('+92'):
        return p[1:]
    if p.startswith('92'):
        return p
    return '92' + p  # catch-all: bare 3XXXXXXXXXX → 923XXXXXXXXXX

def load_csv_teachers():
    """Return list of dicts from STEDA CSV; normalise phone to E.164-ish (leading 92...)."""
    teachers = []
    with open(CSV_PATH, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw = (row.get("WhatsappNo") or "").strip()
            phone = norm_phone(raw)
            if not phone:
                continue
            teachers.append({
                "name":        (row.get("NameOfParticipant") or "").strip(),
                "gender":      (row.get("Gender") or "").strip(),
                "designation": (row.get("Designation") or "").strip(),
                "school":      (row.get("NameOfSchool") or "").strip(),
                "district":    (row.get("District") or "").strip(),
                "phone":       phone,
            })
    return teachers

# ── Page geometry ─────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN    = 1.8 * cm
CONTENT_W = PAGE_W - 2 * MARGIN

# ── Colours ───────────────────────────────────────────────────────────────────
RUMI_TEAL   = colors.HexColor("#0D9488")
RUMI_DARK   = colors.HexColor("#0F172A")
RUMI_MID    = colors.HexColor("#334155")
RUMI_LIGHT  = colors.HexColor("#F1F5F9")
RUMI_ACCENT = colors.HexColor("#F59E0B")
RUMI_RED    = colors.HexColor("#EF4444")
RUMI_GREEN  = colors.HexColor("#22C55E")
RUMI_BLUE   = colors.HexColor("#3B82F6")
WHITE       = colors.white
SUBTLE_LINE = colors.HexColor("#CBD5E1")

# ── Styles ────────────────────────────────────────────────────────────────────
def _s(name, **kw):
    return ParagraphStyle(name, **kw)

S_SECTION     = _s("Section",
    fontName="Helvetica-Bold", fontSize=15, leading=20,
    textColor=WHITE, spaceAfter=4, spaceBefore=18,
    backColor=RUMI_TEAL, leftPadding=10, rightPadding=10,
    topPadding=6, bottomPadding=6)

S_SUBSECTION  = _s("SubSection",
    fontName="Helvetica-Bold", fontSize=11, leading=15,
    textColor=RUMI_TEAL, spaceAfter=4, spaceBefore=10)

S_BODY        = _s("Body",
    fontName="Helvetica", fontSize=9.5, leading=14,
    textColor=RUMI_MID, spaceAfter=4, alignment=TA_LEFT)

S_BODY_BOLD   = _s("BodyBold",
    fontName="Helvetica-Bold", fontSize=9.5, leading=14,
    textColor=RUMI_DARK, spaceAfter=4)

S_CALLOUT     = _s("Callout",
    fontName="Helvetica-Bold", fontSize=10, leading=14,
    textColor=RUMI_DARK, backColor=colors.HexColor("#FEF3C7"),
    leftPadding=10, rightPadding=10, topPadding=8, bottomPadding=8,
    spaceAfter=6, spaceBefore=4,
    borderColor=RUMI_ACCENT, borderWidth=1)

S_SUCCESS     = _s("Success",
    fontName="Helvetica-Bold", fontSize=10, leading=14,
    textColor=WHITE, backColor=RUMI_TEAL,
    leftPadding=10, rightPadding=10, topPadding=8, bottomPadding=8,
    spaceAfter=6, spaceBefore=4)

S_CAPTION     = _s("Caption",
    fontName="Helvetica-Oblique", fontSize=8.5, leading=12,
    textColor=colors.HexColor("#64748B"), alignment=TA_CENTER, spaceAfter=8)

S_TABLE_HDR   = _s("TableHdr",
    fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=WHITE)
S_TABLE_CELL  = _s("TableCell",
    fontName="Helvetica", fontSize=8.5, leading=11, textColor=RUMI_DARK)
S_TABLE_CELL_BOLD = _s("TableCellBold",
    fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=RUMI_DARK)
S_TABLE_TEAL  = _s("TableCellTeal",
    fontName="Helvetica-Bold", fontSize=8.5, leading=11,
    textColor=RUMI_TEAL)

S_KPI_LABEL   = _s("KPILabel",
    fontName="Helvetica", fontSize=8.5, leading=11,
    textColor=colors.HexColor("#64748B"), alignment=TA_CENTER)
S_KPI_VALUE   = _s("KPIValue",
    fontName="Helvetica-Bold", fontSize=22, leading=26,
    textColor=RUMI_TEAL, alignment=TA_CENTER)
S_KPI_SUB     = _s("KPISub",
    fontName="Helvetica", fontSize=8, leading=10,
    textColor=RUMI_MID, alignment=TA_CENTER)

# ── Generic helpers ───────────────────────────────────────────────────────────
def section_header(num, title):
    return [
        Spacer(1, 0.3*cm),
        Paragraph(f"  {num}  {title}", S_SECTION),
        Spacer(1, 0.2*cm),
    ]

def body(text):    return Paragraph(text, S_BODY)
def bold(text):    return Paragraph(text, S_BODY_BOLD)
def hr():
    return HRFlowable(width="100%", thickness=0.5, color=SUBTLE_LINE,
                      spaceAfter=6, spaceBefore=6)
def spacer(h=0.3): return Spacer(1, h * cm)

def kpi_strip(items):
    """items = list of (value, label, sub) — renders a horizontal KPI strip."""
    n = len(items)
    col_w = CONTENT_W / n
    cells = []
    for val, label, sub in items:
        cells.append(Table([
            [Paragraph(str(val),   S_KPI_VALUE)],
            [Paragraph(label,      S_KPI_LABEL)],
            [Paragraph(sub or "",  S_KPI_SUB)],
        ], colWidths=[col_w - 0.4*cm]))
    t = Table([cells], colWidths=[col_w] * n)
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), RUMI_LIGHT),
        ("BOX",           (0,0),(-1,-1), 1, RUMI_TEAL),
        ("LINEAFTER",     (0,0),(-2,-1), 0.5, SUBTLE_LINE),
        ("TOPPADDING",    (0,0),(-1,-1), 10),
        ("BOTTOMPADDING", (0,0),(-1,-1), 10),
        ("ALIGN",         (0,0),(-1,-1), "CENTER"),
        ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
    ]))
    return t

def data_table(headers, rows, col_widths=None, highlight_rows=None, small=False):
    hdr_style   = S_TABLE_HDR
    cell_style  = _s("TC2", fontName="Helvetica",      fontSize=8 if small else 9, leading=11, textColor=RUMI_DARK)
    cell_bold   = _s("TCB2", fontName="Helvetica-Bold", fontSize=8 if small else 9, leading=11, textColor=RUMI_DARK)
    hdr = [Paragraph(str(h), hdr_style) for h in headers]
    data = [hdr]
    for i, row in enumerate(rows):
        s = cell_bold if (highlight_rows and i in highlight_rows) else cell_style
        data.append([Paragraph(str(c), s) for c in row])
    n = len(headers)
    cw = col_widths or [CONTENT_W / n] * n
    t = Table(data, colWidths=cw, repeatRows=1)
    ts = TableStyle([
        ("BACKGROUND",    (0,0),(-1,0),  RUMI_TEAL),
        ("ROWBACKGROUNDS",(0,1),(-1,-1), [WHITE, RUMI_LIGHT]),
        ("GRID",          (0,0),(-1,-1), 0.4, SUBTLE_LINE),
        ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0),(-1,-1), 4),
        ("BOTTOMPADDING", (0,0),(-1,-1), 4),
        ("LEFTPADDING",   (0,0),(-1,-1), 5),
    ])
    if highlight_rows:
        for r in highlight_rows:
            ts.add("BACKGROUND", (0, r+1), (-1, r+1), colors.HexColor("#FEF9C3"))
    t.setStyle(ts)
    return t

# ── Page numbering canvas ─────────────────────────────────────────────────────
class NumberedCanvas(pdfcanvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        np = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_footer(np)
            super().showPage()
        super().save()

    def _draw_footer(self, total):
        pg = self._pageNumber
        if pg == 1:
            return
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#94A3B8"))
        self.drawCentredString(
            PAGE_W / 2, 0.8*cm,
            f"Rumi — STEDA Partner Report  |  Page {pg} of {total}  |  Confidential"
        )
        self.restoreState()

# ── Cover page ────────────────────────────────────────────────────────────────
def cover_page(story, kpis):
    today = datetime.date.today().strftime("%B %d, %Y")

    header = Table(
        [[Paragraph("STEDA × Rumi",
                    _s("ct1", fontName="Helvetica-Bold", fontSize=30, leading=36,
                       textColor=RUMI_TEAL))],
         [Paragraph("Teacher Engagement & Coaching Report",
                    _s("ct2", fontName="Helvetica-Bold", fontSize=20, leading=26,
                       textColor=WHITE))],
         [Spacer(1, 0.4*cm)],
         [Paragraph(
             f"Activation · Engagement · Retention · Feature Discovery · Coaching Observations",
             _s("ct3", fontName="Helvetica", fontSize=10, leading=15,
                textColor=colors.HexColor("#94A3B8")))],
         [Paragraph(
             f"Generated on {today}  ·  Data through April 14, 2026",
             _s("ct4", fontName="Helvetica", fontSize=9, leading=13,
                textColor=colors.HexColor("#64748B")))],
        ],
        colWidths=[CONTENT_W],
    )
    header.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), RUMI_DARK),
        ("TOPPADDING",    (0,0),(-1,-1), 14),
        ("BOTTOMPADDING", (0,0),(-1,-1), 14),
        ("LEFTPADDING",   (0,0),(-1,-1), 20),
        ("RIGHTPADDING",  (0,0),(-1,-1), 20),
        ("LINEBELOW",     (0,0),(-1,-1), 3, RUMI_TEAL),
    ]))
    story.append(header)
    story.append(spacer(0.6))

    # KPI strip
    story.append(kpis)
    story.append(spacer(0.5))

    # Short intro
    story.append(body(
        "This report covers the complete STEDA cohort of <b>176 teachers</b> listed in the STEDA "
        "teacher registry. It tracks their journey on the Rumi platform — from first registration "
        "through platform engagement, feature adoption, and in-classroom coaching observations. "
        "Coaching data covers sessions from <b>March 10, 2026 to April 14, 2026</b>."
    ))
    story.append(spacer(0.3))

    toc_rows = [
        ["01", "Cohort Activation",         "Registration & onboarding status by district"],
        ["02", "Platform Engagement",        "Lesson plans, messages, and usage depth"],
        ["03", "Feature Discovery",          "Which Rumi tools each teacher has used"],
        ["04", "Retention & Activity",       "Active users: last 7 days, 30 days, overall"],
        ["05", "Coaching Observations",      "Sessions, completion, HOTS scores (Mar 10 – Apr 14)"],
        ["06", "Per-Teacher Detail",         "Individual coaching summary for all observed teachers"],
    ]
    toc = Table(
        [[Paragraph(r[0], _s("tn", fontName="Helvetica-Bold", fontSize=11, textColor=RUMI_TEAL)),
          Paragraph(r[1], _s("tt", fontName="Helvetica-Bold", fontSize=10, textColor=RUMI_DARK)),
          Paragraph(r[2], S_BODY)]
         for r in toc_rows],
        colWidths=[CONTENT_W*0.08, CONTENT_W*0.32, CONTENT_W*0.60],
    )
    toc.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0,0),(-1,-1), [WHITE, RUMI_LIGHT]),
        ("GRID",           (0,0),(-1,-1), 0.4, SUBTLE_LINE),
        ("TOPPADDING",     (0,0),(-1,-1), 6),
        ("BOTTOMPADDING",  (0,0),(-1,-1), 6),
        ("LEFTPADDING",    (0,0),(-1,-1), 8),
        ("VALIGN",         (0,0),(-1,-1), "MIDDLE"),
    ]))
    story.append(toc)
    story.append(PageBreak())

# ── Data fetch ────────────────────────────────────────────────────────────────
def fetch_all(teachers):
    phones = [t["phone"] for t in teachers]
    phone_map = {t["phone"]: t for t in teachers}   # phone -> CSV row

    conn = get_conn()
    try:
        # ── 1. Get user rows ──────────────────────────────────────────────────
        rows = q(conn, """
            SELECT id, phone_number,
                   TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) AS name,
                   school_name, preferred_language, created_at::date AS joined
            FROM users
            WHERE phone_number = ANY(%s::text[])
              AND COALESCE(is_test_user, false) = false
        """, (phones,))

        user_map   = {r["phone_number"]: r for r in rows}   # phone -> user row
        user_ids   = [r["id"] for r in rows]
        activated  = len(user_ids)

        # ── 2. Lesson plan stats ──────────────────────────────────────────────
        lp_rows = q(conn, """
            SELECT lpr.user_id,
                   COUNT(*) AS total,
                   COUNT(*) FILTER(WHERE lpr.status='completed') AS completed,
                   MIN(lpr.created_at)::date AS first_lp,
                   MAX(lpr.created_at)::date AS last_lp
            FROM lesson_plan_requests lpr
            WHERE lpr.user_id = ANY(%s::uuid[])
              AND lpr.created_at >= '2026-01-01'
            GROUP BY lpr.user_id
        """, (user_ids,)) if user_ids else []

        lp_by_user = {str(r["user_id"]): r for r in lp_rows}

        # Monthly LP trend
        lp_monthly = q(conn, """
            SELECT DATE_TRUNC('month', created_at)::date AS month,
                   COUNT(*)::int AS requests,
                   COUNT(*) FILTER(WHERE status='completed')::int AS completed
            FROM lesson_plan_requests
            WHERE user_id = ANY(%s::uuid[])
            GROUP BY 1 ORDER BY 1
        """, (user_ids,)) if user_ids else []

        # Top LP users
        top_lp = q(conn, """
            SELECT user_id, COUNT(*) AS n
            FROM lesson_plan_requests
            WHERE user_id = ANY(%s::uuid[]) AND status='completed'
            GROUP BY user_id ORDER BY n DESC LIMIT 15
        """, (user_ids,)) if user_ids else []

        # ── 3. Coaching sessions (all time) ───────────────────────────────────
        cs_rows = q(conn, """
            SELECT cs.user_id,
                   COUNT(*) AS total,
                   COUNT(*) FILTER(WHERE cs.status='completed') AS completed,
                   MIN(cs.created_at)::date AS first_cs,
                   MAX(cs.created_at)::date AS last_cs,
                   ROUND(AVG(
                     COALESCE(cs.analysis_data->'scores'->>'percentage',
                              cs.analysis_data->'scores'->>'overall_percentage')::numeric
                   ) FILTER(WHERE cs.status='completed' AND cs.analysis_data IS NOT NULL), 1)
                     AS avg_score,
                   ROUND(AVG(COALESCE(
                     (cs.analysis_data->'scores'->>'goal1_total')::numeric,
                     (cs.analysis_data->'goal1_formative_assessment'->>'area_score')::numeric,
                     (cs.analysis_data->'scores'->'goal_scores'->'goal1_formative_assessment'->>'area_score')::numeric
                   )) FILTER(WHERE cs.status='completed' AND cs.analysis_data IS NOT NULL), 1) AS avg_g1,
                   ROUND(AVG(COALESCE(
                     (cs.analysis_data->'scores'->>'goal2_total')::numeric,
                     (cs.analysis_data->'goal2_student_engagement'->>'area_score')::numeric,
                     (cs.analysis_data->'scores'->'goal_scores'->'goal2_student_engagement'->>'area_score')::numeric
                   )) FILTER(WHERE cs.status='completed' AND cs.analysis_data IS NOT NULL), 1) AS avg_g2,
                   ROUND(AVG(COALESCE(
                     (cs.analysis_data->'scores'->>'goal3_total')::numeric,
                     (cs.analysis_data->'goal3_quality_content'->>'area_score')::numeric,
                     (cs.analysis_data->'scores'->'goal_scores'->'goal3_quality_content'->>'area_score')::numeric
                   )) FILTER(WHERE cs.status='completed' AND cs.analysis_data IS NOT NULL), 1) AS avg_g3,
                   ROUND(AVG(COALESCE(
                     (cs.analysis_data->'scores'->>'goal4_total')::numeric,
                     (cs.analysis_data->'goal4_classroom_interaction'->>'area_score')::numeric,
                     (cs.analysis_data->'scores'->'goal_scores'->'goal4_classroom_interaction'->>'area_score')::numeric
                   )) FILTER(WHERE cs.status='completed' AND cs.analysis_data IS NOT NULL), 1) AS avg_g4,
                   ROUND(AVG(COALESCE(
                     (cs.analysis_data->'scores'->>'goal5_total')::numeric,
                     (cs.analysis_data->'goal5_classroom_management'->>'area_score')::numeric,
                     (cs.analysis_data->'scores'->'goal_scores'->'goal5_classroom_management'->>'area_score')::numeric
                   )) FILTER(WHERE cs.status='completed' AND cs.analysis_data IS NOT NULL), 1) AS avg_g5
            FROM coaching_sessions cs
            WHERE cs.user_id = ANY(%s::uuid[])
            GROUP BY cs.user_id
        """, (user_ids,)) if user_ids else []

        cs_by_user = {str(r["user_id"]): r for r in cs_rows}

        # ── 4. Coaching sessions March 10 – April 14 2026 ────────────────────
        cs_obs = q(conn, """
            SELECT cs.user_id,
                   COUNT(*) AS total,
                   COUNT(*) FILTER(WHERE cs.status='completed') AS completed,
                   ROUND(AVG(
                     COALESCE(cs.analysis_data->'scores'->>'percentage',
                              cs.analysis_data->'scores'->>'overall_percentage')::numeric
                   ) FILTER(WHERE cs.status='completed' AND cs.analysis_data IS NOT NULL), 1)
                     AS avg_score,
                   ROUND(AVG(COALESCE(
                     (cs.analysis_data->'scores'->>'goal1_total')::numeric,
                     (cs.analysis_data->'goal1_formative_assessment'->>'area_score')::numeric
                   )) FILTER(WHERE cs.status='completed' AND cs.analysis_data IS NOT NULL), 1) AS avg_g1,
                   ROUND(AVG(COALESCE(
                     (cs.analysis_data->'scores'->>'goal2_total')::numeric,
                     (cs.analysis_data->'goal2_student_engagement'->>'area_score')::numeric
                   )) FILTER(WHERE cs.status='completed' AND cs.analysis_data IS NOT NULL), 1) AS avg_g2,
                   ROUND(AVG(COALESCE(
                     (cs.analysis_data->'scores'->>'goal3_total')::numeric,
                     (cs.analysis_data->'goal3_quality_content'->>'area_score')::numeric
                   )) FILTER(WHERE cs.status='completed' AND cs.analysis_data IS NOT NULL), 1) AS avg_g3,
                   ROUND(AVG(COALESCE(
                     (cs.analysis_data->'scores'->>'goal4_total')::numeric,
                     (cs.analysis_data->'goal4_classroom_interaction'->>'area_score')::numeric
                   )) FILTER(WHERE cs.status='completed' AND cs.analysis_data IS NOT NULL), 1) AS avg_g4,
                   ROUND(AVG(COALESCE(
                     (cs.analysis_data->'scores'->>'goal5_total')::numeric,
                     (cs.analysis_data->'goal5_classroom_management'->>'area_score')::numeric
                   )) FILTER(WHERE cs.status='completed' AND cs.analysis_data IS NOT NULL), 1) AS avg_g5
            FROM coaching_sessions cs
            WHERE cs.user_id = ANY(%s::uuid[])
              AND cs.created_at::date >= '2026-03-10'
              AND cs.created_at::date <= '2026-04-14'
            GROUP BY cs.user_id
        """, (user_ids,)) if user_ids else []

        cs_obs_by_user = {str(r["user_id"]): r for r in cs_obs}

        # ── 5. Feature flags ─────────────────────────────────────────────────
        feat_lp = set(str(r["user_id"]) for r in lp_rows if int(r["total"]) > 0)

        feat_cs = set(str(r["user_id"]) for r in cs_rows if int(r["total"]) > 0)

        # reading assessments
        try:
            ra_rows = q(conn, "SELECT DISTINCT user_id FROM reading_assessments WHERE user_id = ANY(%s::uuid[])", (user_ids,))
            feat_ra = set(str(r["user_id"]) for r in ra_rows)
        except Exception:
            feat_ra = set()

        # video requests
        try:
            vr_rows = q(conn, "SELECT DISTINCT user_id FROM video_requests WHERE user_id = ANY(%s::uuid[])", (user_ids,))
            feat_vr = set(str(r["user_id"]) for r in vr_rows)
        except Exception:
            feat_vr = set()

        # image analysis
        try:
            ia_rows = q(conn, "SELECT DISTINCT user_id FROM image_analysis_requests WHERE user_id = ANY(%s::uuid[])", (user_ids,))
            feat_ia = set(str(r["user_id"]) for r in ia_rows)
        except Exception:
            feat_ia = set()

        # conversations (chatbot)
        try:
            cv_rows = q(conn, "SELECT DISTINCT user_id FROM conversations WHERE user_id = ANY(%s::uuid[])", (user_ids,))
            feat_cv = set(str(r["user_id"]) for r in cv_rows)
        except Exception:
            feat_cv = set()

        # ── 6. Activity (last 7 / 30 days) ───────────────────────────────────
        cutoff_7  = datetime.date.today() - datetime.timedelta(days=7)
        cutoff_30 = datetime.date.today() - datetime.timedelta(days=30)

        active_30 = q(conn, """
            SELECT DISTINCT user_id FROM lesson_plan_requests
            WHERE user_id = ANY(%s::uuid[]) AND created_at::date >= %s
            UNION
            SELECT DISTINCT user_id FROM coaching_sessions
            WHERE user_id = ANY(%s::uuid[]) AND created_at::date >= %s
        """, (user_ids, cutoff_30, user_ids, cutoff_30)) if user_ids else []

        active_7 = q(conn, """
            SELECT DISTINCT user_id FROM lesson_plan_requests
            WHERE user_id = ANY(%s::uuid[]) AND created_at::date >= %s
            UNION
            SELECT DISTINCT user_id FROM coaching_sessions
            WHERE user_id = ANY(%s::uuid[]) AND created_at::date >= %s
        """, (user_ids, cutoff_7, user_ids, cutoff_7)) if user_ids else []

        # Activation by month (join date)
        join_by_month = {}
        for r in rows:
            m = str(r["joined"])[:7] if r["joined"] else "unknown"
            join_by_month[m] = join_by_month.get(m, 0) + 1

    finally:
        conn.close()

    return {
        "teachers":       teachers,
        "phones":         phones,
        "phone_map":      phone_map,
        "user_map":       user_map,
        "user_ids":       user_ids,
        "activated":      activated,
        "lp_by_user":     lp_by_user,
        "lp_monthly":     lp_monthly,
        "top_lp":         top_lp,
        "cs_by_user":     cs_by_user,
        "cs_obs_by_user": cs_obs_by_user,
        "feat_lp":        feat_lp,
        "feat_cs":        feat_cs,
        "feat_ra":        feat_ra,
        "feat_vr":        feat_vr,
        "feat_ia":        feat_ia,
        "feat_cv":        feat_cv,
        "active_30":      set(str(r["user_id"]) for r in active_30),
        "active_7":       set(str(r["user_id"]) for r in active_7),
        "join_by_month":  join_by_month,
    }

# ── Section builders ──────────────────────────────────────────────────────────
def sec_activation(story, d):
    story += section_header("01", "Cohort Activation")

    total    = len(d["teachers"])
    act      = d["activated"]
    not_act  = total - act
    pct      = round(act / total * 100) if total else 0

    story.append(kpi_strip([
        (f"{act}", "Teachers Activated", f"{pct}% of cohort"),
        (f"{not_act}", "Not Yet on Rumi", f"{100-pct}% pending"),
        (f"{total}", "Total in Cohort", "STEDA Teacher Registry"),
        (str(len(d["join_by_month"])), "Months with Joiners", ""),
    ]))
    story.append(spacer(0.4))

    story.append(body(
        f"Of the <b>{total} teachers</b> in the STEDA registry, <b>{act} ({pct}%)</b> have registered "
        f"on Rumi. <b>{not_act}</b> teachers have not yet joined the platform. "
        "The table below shows activation by district, sorted by size."
    ))
    story.append(spacer(0.3))

    # District breakdown
    dist_act   = {}
    dist_total = {}
    for t in d["teachers"]:
        dist = t["district"] or "Unknown"
        dist_total[dist] = dist_total.get(dist, 0) + 1
        if t["phone"] in d["user_map"]:
            dist_act[dist] = dist_act.get(dist, 0) + 1

    dist_rows = []
    for dist, tot in sorted(dist_total.items(), key=lambda x: -x[1]):
        a = dist_act.get(dist, 0)
        p = round(a / tot * 100) if tot else 0
        dist_rows.append([dist, str(tot), str(a), str(tot - a), f"{p}%"])

    story.append(data_table(
        ["District", "In Registry", "Activated", "Not Joined", "Activation %"],
        dist_rows,
        col_widths=[CONTENT_W*0.34, CONTENT_W*0.16, CONTENT_W*0.16, CONTENT_W*0.16, CONTENT_W*0.18],
    ))
    story.append(spacer(0.4))

    # Join timeline
    if d["join_by_month"]:
        story.append(Paragraph("Registration Timeline", S_SUBSECTION))
        month_rows = [
            [m, str(n), f"{round(n/act*100)}% of activated" if act else ""]
            for m, n in sorted(d["join_by_month"].items())
        ]
        story.append(data_table(
            ["Month", "Teachers Joined", "Share of Activated"],
            month_rows,
            col_widths=[CONTENT_W*0.28, CONTENT_W*0.28, CONTENT_W*0.44],
        ))

    story.append(PageBreak())

def sec_engagement(story, d):
    story += section_header("02", "Platform Engagement")

    user_ids_set = set(d["user_ids"])
    lp_total  = sum(int(v["total"]) for v in d["lp_by_user"].values())
    lp_done   = sum(int(v["completed"]) for v in d["lp_by_user"].values())
    lp_users  = len(d["lp_by_user"])
    cs_total  = sum(int(v["total"]) for v in d["cs_by_user"].values())
    cs_done   = sum(int(v["completed"]) for v in d["cs_by_user"].values())
    cs_users  = len(d["cs_by_user"])

    story.append(kpi_strip([
        (str(lp_total),  "Lesson Plans Requested",  f"{lp_done} completed"),
        (str(lp_users),  "Teachers Used Lesson AI",  f"of {d['activated']} activated"),
        (str(cs_total),  "Coaching Sessions",         f"{cs_done} completed"),
        (str(cs_users),  "Teachers Coached",          ""),
    ]))
    story.append(spacer(0.4))

    story.append(Paragraph("Lesson Plan Monthly Trend", S_SUBSECTION))
    if d["lp_monthly"]:
        month_data = [
            [str(r["month"])[:7], str(r["requests"]), str(r["completed"]),
             f"{round(r['completed']/r['requests']*100)}%" if r["requests"] else "—"]
            for r in d["lp_monthly"]
        ]
        story.append(data_table(
            ["Month", "Requests", "Completed", "Completion Rate"],
            month_data,
            col_widths=[CONTENT_W*0.25, CONTENT_W*0.25, CONTENT_W*0.25, CONTENT_W*0.25],
        ))
    else:
        story.append(body("No lesson plan data available."))

    story.append(spacer(0.4))

    # Top lesson plan users
    story.append(Paragraph("Most Active Lesson Plan Users", S_SUBSECTION))
    story.append(body(
        "Teachers who have generated the most lesson plans since joining Rumi "
        "(completed requests only)."
    ))
    story.append(spacer(0.2))

    top_rows = []
    for r in d["top_lp"][:15]:
        uid = str(r["user_id"])
        phone = next((p for p, u in d["user_map"].items() if str(u["id"]) == uid), "")
        csv_t = d["phone_map"].get(phone, {})
        # Prefer full name from registry CSV; fall back to DB name
        name  = csv_t.get("name") or d["user_map"].get(phone, {}).get("name") or phone
        dist  = csv_t.get("district", "—")
        top_rows.append([name, dist, str(r["n"])])

    if top_rows:
        story.append(data_table(
            ["Teacher", "District", "Completed LPs"],
            top_rows,
            col_widths=[CONTENT_W*0.45, CONTENT_W*0.35, CONTENT_W*0.20],
        ))

    story.append(PageBreak())

def sec_features(story, d):
    story += section_header("03", "Feature Discovery")

    act  = d["activated"]
    f_lp = len(d["feat_lp"])
    f_cs = len(d["feat_cs"])
    f_ra = len(d["feat_ra"])
    f_vr = len(d["feat_vr"])
    f_ia = len(d["feat_ia"])
    f_cv = len(d["feat_cv"])

    def pct(n): return f"{round(n/act*100)}%" if act else "—"

    story.append(body(
        "Feature discovery measures how broadly STEDA teachers explore Rumi's capabilities "
        "beyond their first interaction. Each row below shows a distinct feature and how many "
        "activated teachers have used it at least once."
    ))
    story.append(spacer(0.3))

    feat_rows = [
        ["Lesson Plan Generator",   str(f_lp), pct(f_lp), "Core feature — AI writes full lesson plans"],
        ["Coaching Observations",   str(f_cs), pct(f_cs), "In-class observation with HOTS scoring"],
        ["Reading Assessments",     str(f_ra), pct(f_ra), "Student reading level diagnostic"],
        ["Video Analysis",          str(f_vr), pct(f_vr), "Classroom video AI review"],
        ["Image Analysis",          str(f_ia), pct(f_ia), "Worksheet / resource analysis"],
        ["AI Chatbot",              str(f_cv), pct(f_cv), "Free-form teacher Q&A"],
    ]

    story.append(data_table(
        ["Feature", "Users", "% of Activated", "Description"],
        feat_rows,
        col_widths=[CONTENT_W*0.26, CONTENT_W*0.10, CONTENT_W*0.16, CONTENT_W*0.48],
    ))
    story.append(spacer(0.4))

    # Multi-feature users
    multi = 0
    for phone, user in d["user_map"].items():
        uid = str(user["id"])
        used = sum([
            uid in d["feat_lp"],
            uid in d["feat_cs"],
            uid in d["feat_ra"],
            uid in d["feat_vr"],
            uid in d["feat_ia"],
            uid in d["feat_cv"],
        ])
        if used >= 2:
            multi += 1

    story.append(Paragraph(
        f"Multi-Feature Adoption:  <b>{multi}</b> teachers ({pct(multi)}) have used 2 or more distinct Rumi features.",
        S_CALLOUT,
    ))
    story.append(PageBreak())

def sec_retention(story, d):
    story += section_header("04", "Retention & Activity")

    act   = d["activated"]
    a30   = len(d["active_30"])
    a7    = len(d["active_7"])
    def pct(n): return f"{round(n/act*100)}%" if act else "—"

    story.append(kpi_strip([
        (str(a30), "Active Last 30 Days",  pct(a30)),
        (str(a7),  "Active Last 7 Days",   pct(a7)),
        (str(act - a30), "Inactive 30+ Days", pct(act - a30)),
    ]))
    story.append(spacer(0.4))

    story.append(body(
        "Retention tracks how many teachers remain actively using Rumi after their initial "
        "onboarding. A teacher is considered <b>active</b> if they made at least one lesson plan "
        "request or participated in a coaching session within the period."
    ))
    story.append(spacer(0.3))

    # LP user depth buckets
    buckets = {"1 session": 0, "2–5": 0, "6–10": 0, "11–20": 0, "21+": 0}
    for uid, r in d["lp_by_user"].items():
        n = int(r["completed"])
        if n == 1:
            buckets["1 session"] += 1
        elif n <= 5:
            buckets["2–5"] += 1
        elif n <= 10:
            buckets["6–10"] += 1
        elif n <= 20:
            buckets["11–20"] += 1
        else:
            buckets["21+"] += 1

    story.append(Paragraph("Lesson Plan Usage Depth (completed requests)", S_SUBSECTION))
    depth_rows = [[k, str(v), pct(v)] for k, v in buckets.items()]
    story.append(data_table(
        ["Bucket", "Teachers", "% of Activated"],
        depth_rows,
        col_widths=[CONTENT_W*0.30, CONTENT_W*0.30, CONTENT_W*0.40],
    ))
    story.append(PageBreak())

def sec_coaching_overview(story, d):
    story += section_header("05", "Coaching Observations — March 10 to April 14, 2026")

    obs  = d["cs_obs_by_user"]
    act  = d["activated"]

    # Teachers with any session in window
    obs_teachers = len(obs)
    obs_sessions = sum(int(r["total"]) for r in obs.values())
    obs_done     = sum(int(r["completed"]) for r in obs.values())
    comp_rate    = round(obs_done / obs_sessions * 100) if obs_sessions else 0

    # Avg HOTS across observed teachers
    scores = [float(r["avg_score"]) for r in obs.values() if r["avg_score"] is not None]
    avg_hots = round(sum(scores) / len(scores), 1) if scores else None

    story.append(kpi_strip([
        (str(obs_teachers), "Teachers Observed",    f"of {act} activated"),
        (str(obs_sessions), "Total Sessions",        "Mar 10 – Apr 14"),
        (str(obs_done),     "Sessions Completed",   f"{comp_rate}% completion rate"),
        (f"{avg_hots}%" if avg_hots else "—", "Avg HOTS Score",  "across completed sessions"),
    ]))
    story.append(spacer(0.4))

    story.append(body(
        "Coaching observations are structured in-class reviews scored against five HOTS "
        "(Higher Order Thinking Skills) indicators. Each session produces a percentage score "
        "reflecting the teacher's overall performance, plus sub-scores for each indicator."
    ))
    story.append(spacer(0.3))

    story.append(Paragraph("HOTS Indicator Framework", S_SUBSECTION))
    ind_rows = [
        ["HOTS 1", "Formative Assessment",     "Use of checks for understanding, questioning"],
        ["HOTS 2", "Student Engagement",       "Active participation, higher-order tasks"],
        ["HOTS 3", "Quality of Content",       "Rigor, accuracy, depth of instruction"],
        ["HOTS 4", "Classroom Interaction",    "Student-to-student discourse, reasoning"],
        ["HOTS 5", "Classroom Management",     "Environment, time-on-task, transitions"],
    ]
    story.append(data_table(
        ["Code", "Indicator", "What Is Assessed"],
        ind_rows,
        col_widths=[CONTENT_W*0.12, CONTENT_W*0.30, CONTENT_W*0.58],
    ))
    story.append(spacer(0.4))

    # District summary for observed teachers
    story.append(Paragraph("Observations by District", S_SUBSECTION))
    dist_obs = {}
    for phone, user in d["user_map"].items():
        uid = str(user["id"])
        if uid in obs:
            csv_t = d["phone_map"].get(phone, {})
            dist = csv_t.get("district", "Unknown")
            if dist not in dist_obs:
                dist_obs[dist] = {"teachers": 0, "sessions": 0, "done": 0, "scores": []}
            dist_obs[dist]["teachers"] += 1
            dist_obs[dist]["sessions"] += int(obs[uid]["total"])
            dist_obs[dist]["done"]     += int(obs[uid]["completed"])
            if obs[uid]["avg_score"] is not None:
                dist_obs[dist]["scores"].append(float(obs[uid]["avg_score"]))

    dist_rows = []
    for dist, dd in sorted(dist_obs.items(), key=lambda x: -x[1]["teachers"]):
        avg = round(sum(dd["scores"]) / len(dd["scores"]), 1) if dd["scores"] else "—"
        dist_rows.append([
            dist, str(dd["teachers"]), str(dd["sessions"]), str(dd["done"]),
            f"{avg}%" if avg != "—" else "—",
        ])

    story.append(data_table(
        ["District", "Teachers", "Sessions", "Completed", "Avg HOTS %"],
        dist_rows,
        col_widths=[CONTENT_W*0.34, CONTENT_W*0.16, CONTENT_W*0.16, CONTENT_W*0.16, CONTENT_W*0.18],
    ))
    story.append(PageBreak())

def sec_per_teacher(story, d):
    story += section_header("06", "Per-Teacher Coaching Detail")

    story.append(body(
        "The table below lists every STEDA teacher who had at least one coaching session "
        "between March 10 and April 14, 2026. Scores are averaged across completed sessions. "
        "'—' means no completed session with scored data in that indicator."
    ))
    story.append(spacer(0.3))

    obs  = d["cs_obs_by_user"]
    rows = []

    for phone, user in sorted(d["user_map"].items(),
                               key=lambda x: x[1].get("name") or ""):
        uid  = str(user["id"])
        if uid not in obs:
            continue
        r    = obs[uid]
        csv_t = d["phone_map"].get(phone, {})
        name  = user.get("name") or phone
        dist  = csv_t.get("district", "—")
        desig = csv_t.get("designation", "—")

        def fmt(v):
            return str(v) if v is not None else "—"

        rows.append([
            name, dist, desig,
            fmt(r["completed"]),
            fmt(r["avg_score"]) + ("%" if r["avg_score"] is not None else ""),
            fmt(r["avg_g1"]), fmt(r["avg_g2"]), fmt(r["avg_g3"]),
            fmt(r["avg_g4"]), fmt(r["avg_g5"]),
        ])

    if rows:
        story.append(data_table(
            ["Teacher", "District", "Desig.", "Done", "HOTS%", "G1", "G2", "G3", "G4", "G5"],
            rows,
            col_widths=[
                CONTENT_W*0.22,  # name
                CONTENT_W*0.18,  # district
                CONTENT_W*0.08,  # desig
                CONTENT_W*0.06,  # done
                CONTENT_W*0.08,  # hots%
                CONTENT_W*0.076, # g1
                CONTENT_W*0.076, # g2
                CONTENT_W*0.076, # g3
                CONTENT_W*0.076, # g4
                CONTENT_W*0.076, # g5
            ],
            small=True,
        ))
    else:
        story.append(body("No coaching sessions found in the March 10 – April 14 window."))

    story.append(spacer(0.4))
    story.append(hr())
    story.append(body(
        "<i>G1 = Formative Assessment · G2 = Student Engagement · G3 = Quality of Content · "
        "G4 = Classroom Interaction · G5 = Classroom Management. "
        "Scores are on the rubric scale (not %). HOTS% is the overall session percentage.</i>"
    ))
    story.append(spacer(0.4))
    story.append(hr())
    today_str = datetime.datetime.now().strftime("%B %d, %Y at %H:%M")
    story.append(body(
        f"<i>Report generated from the Rumi production database on {today_str}. "
        "All data is read-only. Coaching window: March 10 – April 14, 2026.</i>"
    ))

# ── Build ─────────────────────────────────────────────────────────────────────
def build(d):
    story = []

    # Cover KPIs
    obs_count = len(d["cs_obs_by_user"])
    lp_total  = sum(int(v["total"]) for v in d["lp_by_user"].values())
    kpis = kpi_strip([
        (str(len(d["teachers"])),    "Teachers in Registry",  "STEDA cohort"),
        (str(d["activated"]),        "Activated on Rumi",     f"{round(d['activated']/len(d['teachers'])*100)}% of registry"),
        (str(lp_total),              "Lesson Plans Created",  "total requests"),
        (str(obs_count),             "Teachers Observed",     "Mar 10 – Apr 14, 2026"),
    ])
    cover_page(story, kpis)

    sec_activation(story, d)
    sec_engagement(story, d)
    sec_features(story, d)
    sec_retention(story, d)
    sec_coaching_overview(story, d)
    sec_per_teacher(story, d)

    return story

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Loading STEDA teacher CSV …")
    teachers = load_csv_teachers()
    print(f"  {len(teachers)} teachers loaded")

    print("Fetching data from database …")
    d = fetch_all(teachers)
    print(f"  {d['activated']} activated users found")
    print(f"  {sum(int(v['total']) for v in d['lp_by_user'].values())} lesson plan requests")
    print(f"  {len(d['cs_obs_by_user'])} teachers with coaching sessions (Mar 10–Apr 14)")

    print("Building PDF …")
    doc = SimpleDocTemplate(
        str(OUT_PDF),
        pagesize=A4,
        topMargin=MARGIN,
        bottomMargin=1.4*cm,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        title="STEDA × Rumi — Engagement & Coaching Report",
        author="Rumi Data Team",
        subject="Teacher Engagement, Feature Discovery & HOTS Coaching",
    )
    story = build(d)
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"\nPDF saved → {OUT_PDF}")

if __name__ == "__main__":
    main()
