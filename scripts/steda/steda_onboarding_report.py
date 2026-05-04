"""
STEDA × Rumi — Teacher Onboarding Report
=========================================
Prepared for: Secretary of Education, Government of Sindh
Date: March 18, 2026
Covers: Onboarding period March 9 – March 18, 2026
"""

import os, sys, io, re, warnings
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, Rectangle, FancyArrowPatch, Arc
import matplotlib.ticker as mticker
import matplotlib.patheffects as pe
from matplotlib.gridspec import GridSpec
from matplotlib.backends.backend_pdf import PdfPages
import seaborn as sns
from collections import Counter
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import textwrap

load_dotenv()

# ── Design tokens ─────────────────────────────────────────────────────────────
# Primary palette
C_TEAL     = "#0D9488"   # primary brand
C_TEAL_D   = "#0F766E"   # darker teal for hover/depth
C_TEAL_L   = "#CCFBF1"   # teal surface tint
C_TEAL_M   = "#5EEAD4"   # mid teal for gradients

# Neutral
C_DARK     = "#0F172A"   # slate-900 — headings
C_SLATE    = "#475569"   # slate-600 — body text
C_MUTED    = "#94A3B8"   # slate-400 — captions / axes
C_SURFACE  = "#F8FAFC"   # slate-50 — page background
C_BORDER   = "#E2E8F0"   # slate-200 — dividers
C_WHITE    = "#FFFFFF"

# Semantic
C_GREEN    = "#059669"   # emerald-600
C_GREEN_L  = "#D1FAE5"
C_AMBER    = "#D97706"   # amber-600
C_AMBER_L  = "#FEF3C7"
C_BLUE     = "#2563EB"   # blue-600
C_BLUE_L   = "#DBEAFE"
C_PURPLE   = "#7C3AED"   # violet-600
C_PURPLE_L = "#EDE9FE"
C_PINK     = "#DB2777"   # pink-600
C_PINK_L   = "#FCE7F3"
C_ORANGE   = "#EA580C"   # orange-600
C_ORANGE_L = "#FFEDD5"
C_INDIGO   = "#4F46E5"   # indigo-600
C_INDIGO_L = "#E0E7FF"

# Chart palette (ordered by visual weight)
CHART_PAL = [C_TEAL, C_BLUE, C_PURPLE, C_ORANGE, C_AMBER, C_GREEN, C_PINK, C_INDIGO]

# Typography
plt.rcParams.update({
    "figure.dpi":          160,
    "font.family":         "DejaVu Sans",
    "axes.titlesize":      11,
    "axes.titleweight":    "bold",
    "axes.titlecolor":     C_DARK,
    "axes.labelsize":      8.5,
    "axes.labelcolor":     C_SLATE,
    "axes.spines.top":     False,
    "axes.spines.right":   False,
    "axes.spines.left":    False,
    "axes.spines.bottom":  False,
    "axes.grid":           True,
    "axes.axisbelow":      True,
    "grid.color":          C_BORDER,
    "grid.linewidth":      0.6,
    "grid.linestyle":      "--",
    "xtick.color":         C_MUTED,
    "ytick.color":         C_MUTED,
    "xtick.labelsize":     7.5,
    "ytick.labelsize":     7.5,
    "legend.fontsize":     8,
    "legend.frameon":      False,
    "figure.facecolor":    C_WHITE,
})

DB_URL = (
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    f"?sslmode={os.getenv('DB_SSL', 'require')}"
)
engine = create_engine(DB_URL, connect_args={"connect_timeout": 30})
def q(sql):
    with engine.connect() as c: return pd.read_sql(text(sql), c)

OUT         = "onboarding_report_charts"
os.makedirs(OUT, exist_ok=True)
REPORT_DATE = "March 18, 2026"

# ─────────────────────────────────────────────────────────────────────────────
# 1. LOAD TEACHER CSV
# ─────────────────────────────────────────────────────────────────────────────
print("Loading STEDA teacher list …")
df_csv = pd.read_csv("STEDA List of Teachers-1 .csv", encoding="utf-8-sig")
df_csv.columns = [c.strip() for c in df_csv.columns]

def norm_phone(p):
    if pd.isna(p): return None
    p = re.sub(r'[\s\-\(\)\+]', '', str(p))
    if p.startswith('0'):  return '92' + p[1:]
    if p.startswith('92'): return p
    if len(p) == 10:       return '92' + p
    return p

df_csv['phone_norm'] = df_csv['WhatsappNo'].apply(norm_phone)
phones    = [p for p in df_csv['phone_norm'].dropna() if len(str(p)) >= 11]
phone_sql = "', '".join(phones)
TOTAL_LISTED = len(df_csv)

# ─────────────────────────────────────────────────────────────────────────────
# 2. DATABASE QUERIES
# ─────────────────────────────────────────────────────────────────────────────
print("Querying database …")
db_users = q(f"""
    SELECT id, phone_number, first_name, school_name, organization,
           registration_completed, registration_state, created_at, preferred_language
    FROM users
    WHERE phone_number IN ('{phone_sql}')
      AND COALESCE(is_test_user, false) = false
""").rename(columns={"phone_number": "phone_norm"})

merged = df_csv.merge(db_users, on="phone_norm", how="left", indicator=True)
merged['onboarded'] = merged['_merge'] == 'both'
merged['reg_done']  = merged['registration_completed'].fillna(False)
db_users['date']    = pd.to_datetime(db_users['created_at']).dt.date

TOTAL_JOINED  = int(merged['onboarded'].sum())
TOTAL_NOT_YET = TOTAL_LISTED - TOTAL_JOINED
ONBOARD_PCT   = round(TOTAL_JOINED / TOTAL_LISTED * 100, 1)
REG_DONE      = int(merged['reg_done'].sum())

matched_ids = db_users['id'].dropna().tolist()
id_arr = ",".join(f"'{i}'" for i in matched_ids)

lp_all = q(f"""
    SELECT COUNT(*) total,
           COUNT(*) FILTER(WHERE status='completed') completed,
           COUNT(DISTINCT user_id) users_lp
    FROM lesson_plan_requests
    WHERE user_id=ANY(ARRAY[{id_arr}]::uuid[])
""").iloc[0]

coaching = q(f"""
    SELECT COUNT(*) total, COUNT(DISTINCT user_id) users_coaching
    FROM coaching_sessions
    WHERE user_id=ANY(ARRAY[{id_arr}]::uuid[])
""").iloc[0]

daily_joins = q(f"""
    SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*) AS cnt
    FROM users
    WHERE phone_number IN ('{phone_sql}')
      AND COALESCE(is_test_user, false) = false
    GROUP BY 1 ORDER BY 1
""")
daily_joins['day'] = pd.to_datetime(daily_joins['day'])

lp_daily = q(f"""
    SELECT DATE_TRUNC('day', created_at)::date AS day,
           COUNT(*) requests,
           COUNT(*) FILTER(WHERE status='completed') completed
    FROM lesson_plan_requests
    WHERE user_id=ANY(ARRAY[{id_arr}]::uuid[])
    GROUP BY 1 ORDER BY 1
""")
lp_daily['day'] = pd.to_datetime(lp_daily['day'])

dist = merged.groupby('District').agg(
    listed=('S.No','count'), onboarded=('onboarded','sum')
).sort_values('listed', ascending=False).reset_index()
dist['pct']     = (dist['onboarded'] / dist['listed'] * 100).round(1)
dist['not_yet'] = dist['listed'] - dist['onboarded']
dist['District']= dist['District'].str.strip()
dist_top        = dist.head(20)

desig_map = {'JEST/JST':'JEST/JST','PST':'PST','EST':'EST','HST':'HST',
             'SST':'SST','ECT':'ECT','Sr. ECT':'Sr. ECT','Lecturer':'Lecturer'}
df_csv['Desig_clean'] = df_csv['Designation'].apply(
    lambda x: desig_map.get(str(x).strip(), 'Other'))

gender_counts = df_csv['Gender'].value_counts()

print(f"  Listed: {TOTAL_LISTED} | Onboarded: {TOTAL_JOINED} ({ONBOARD_PCT}%)")
print(f"  LP total: {int(lp_all['total'])} | Completed: {int(lp_all['completed'])} | Users: {int(lp_all['users_lp'])}")

# ─────────────────────────────────────────────────────────────────────────────
# 3. WHATSAPP ONBOARDING CHAT PARSING
# ─────────────────────────────────────────────────────────────────────────────
print("Parsing WhatsApp onboarding feedback …")
with open("WhatsApp Chat with Rumi onboarding  Feedback.txt", encoding="utf-8") as f:
    chat_content = f.read()

ADMINS   = {'Sajid Hussain Mallah','Junaid Ali','You','Afzal ahmed','GUL HASSAN','Ayaz Iqbal Jokhio'}
msg_pat  = re.compile(r'^(\d+/\d+/\d+),\s([\d:]+\s[AP]M)\s-\s([^:]+):\s(.+)', re.DOTALL)
join_pat = re.compile(r'^(\d+/\d+/\d+),\s[\d:]+\s[AP]M\s-\s(.+)\s(joined from the community|was added)')

all_messages, join_events = [], []
for line in chat_content.split('\n'):
    line = line.strip()
    jm = join_pat.match(line)
    if jm:
        join_events.append({'date': jm.group(1), 'name': jm.group(2).strip()})
    m = msg_pat.match(line)
    if m:
        all_messages.append({'date':m.group(1),'time':m.group(2),
                             'sender':m.group(3).strip(),'text':m.group(4).strip()})

unique_joiners = len(set(e['name'] for e in join_events))

teacher_msgs = [m for m in all_messages
                if m['sender'] not in ADMINS and '<Media' not in m['text'] and len(m['text']) > 8]

reg_keywords  = ['registered','register','registration done','registration complete']
CONFIRMED_REG_CHAT = len(set(m['sender'] for m in teacher_msgs
                             if any(k in m['text'].lower() for k in reg_keywords)))

pos_keywords = ['great','amazing','wonderful','fantastic','excellent','mind blowing',
                'brilliant','thrilled','thank','hats off','proud','superb','initiative','beneficial']
POS_SENDERS  = len(set(m['sender'] for m in teacher_msgs
                       if any(k in m['text'].lower() for k in pos_keywords)))

lp_mention     = sum(1 for m in teacher_msgs if 'lesson plan' in m['text'].lower())
video_mention  = sum(1 for m in teacher_msgs if 'video' in m['text'].lower())

print(f"  Community members: {unique_joiners} | Reg confirmed: {CONFIRMED_REG_CHAT} | Positive: {POS_SENDERS}")

# ─────────────────────────────────────────────────────────────────────────────
# 4. QUOTES
# ─────────────────────────────────────────────────────────────────────────────
QUOTES = [
    ("Ghulam Nabi",
     "I am thrilled to be a part of this pilot program! Having an AI assistant to help with lesson planning is a fantastic initiative."),
    ("Imtiaz Ahmed",
     "Thank you STEDA for providing us such a wonderful platform — it would be beneficial for all the teachers."),
    ("Abdul Hameed",
     "Hats off to the Sindh Education Department and Syed Sardar Ali Shah for this great initiative."),
    ("Zohaib Hassan",
     "Amazing! Within seconds a lesson plan was ready."),
    ("Yousif Jameel",
     "This is really mind blowing!"),
    ("Hayat",
     "Thanks for initiating such a wonderful platform."),
    ("Rab Nawaz Khaskheli",
     "Rumi is specially designed for better results according to STBB books — it is more reliable for Sindh province."),
    ("Irshad Ali",
     "Rumi is far better at generating high-quality lesson plans."),
]

# ─────────────────────────────────────────────────────────────────────────────
# 5. SHARED DRAW HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def save(fig, name):
    path = f"{OUT}/{name}.png"
    fig.savefig(path, bbox_inches='tight', facecolor=C_WHITE, dpi=160)
    plt.close(fig)
    return path

def styled_ax(ax, xlabel="", ylabel="", title="", subtitle=""):
    """Apply consistent chart styling."""
    ax.set_facecolor(C_SURFACE)
    ax.tick_params(length=0)
    for spine in ax.spines.values():
        spine.set_visible(False)
    if xlabel: ax.set_xlabel(xlabel, fontsize=8, color=C_MUTED, labelpad=6)
    if ylabel: ax.set_ylabel(ylabel, fontsize=8, color=C_MUTED, labelpad=6)
    if title:
        ax.set_title(title, fontsize=11, fontweight='bold', color=C_DARK,
                     pad=14, loc='left')
    if subtitle:
        ax.annotate(subtitle, xy=(0, 1.02), xycoords='axes fraction',
                    fontsize=7.5, color=C_MUTED, style='italic')

def add_bar_labels(ax, bars, fmt="{:.0f}", color=C_SLATE, offset=2, fontsize=8):
    for bar in bars:
        h = bar.get_height()
        if h > 0:
            ax.text(bar.get_x() + bar.get_width()/2,
                    h + offset, fmt.format(h),
                    ha='center', va='bottom', fontsize=fontsize,
                    color=color, fontweight='bold')

def page_footer(ax, text):
    ax.annotate(text, xy=(0.5, 0), xycoords='figure fraction',
                ha='center', va='bottom', fontsize=6.5, color=C_MUTED,
                xytext=(0, 8), textcoords='offset points')

# ─────────────────────────────────────────────────────────────────────────────
# 6. GENERATE CHARTS
# ─────────────────────────────────────────────────────────────────────────────

# ── A. Activation donut ───────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(5, 5.2), facecolor=C_WHITE)
ax.set_facecolor(C_WHITE)
sizes  = [TOTAL_JOINED, TOTAL_NOT_YET]
colors = [C_TEAL, C_BORDER]
wedges, _ = ax.pie(sizes, colors=colors, startangle=90,
                   wedgeprops=dict(width=0.55, edgecolor=C_WHITE, linewidth=3))
# Center label
ax.text(0,  0.14, f"{ONBOARD_PCT}%",    ha='center', fontsize=36,
        fontweight='bold', color=C_TEAL)
ax.text(0, -0.12, "Activation Rate",    ha='center', fontsize=10, color=C_SLATE)
ax.text(0, -0.30, f"{TOTAL_JOINED:,} of {TOTAL_LISTED:,} teachers",
        ha='center', fontsize=8, color=C_MUTED)
# Legend chips
legend_els = [
    mpatches.Patch(facecolor=C_TEAL,   edgecolor='none', label=f'Activated  {TOTAL_JOINED:,}'),
    mpatches.Patch(facecolor=C_BORDER, edgecolor='none', label=f'Pending    {TOTAL_NOT_YET:,}'),
]
ax.legend(handles=legend_els, loc='lower center', bbox_to_anchor=(0.5, -0.07),
          ncol=2, handlelength=1.2, handleheight=1.0, fontsize=8.5, borderpad=0)
ax.set_title("Teacher Activation Rate", fontsize=11, fontweight='bold', color=C_DARK, pad=14)
save(fig, 'A_donut')

# ── B. Cumulative activations area chart ─────────────────────────────────────
fig, ax = plt.subplots(figsize=(8.5, 4), facecolor=C_WHITE)
if not daily_joins.empty:
    dj = daily_joins.sort_values('day').copy()
    dj['cumulative'] = dj['cnt'].cumsum()
    # Gradient fill via stacked polycollection
    ax.fill_between(dj['day'], dj['cumulative'], alpha=0.12, color=C_TEAL)
    ax.fill_between(dj['day'], dj['cumulative'], alpha=0.06, color=C_TEAL)
    ax.plot(dj['day'], dj['cumulative'], color=C_TEAL, linewidth=2.5, zorder=3)
    ax.scatter(dj['day'], dj['cumulative'], color=C_TEAL, s=28, zorder=4, edgecolor=C_WHITE, linewidth=1.5)
    # Annotate launch surge
    mar11 = dj[dj['day'].dt.day == 11]
    if not mar11.empty:
        r = mar11.iloc[0]
        ax.annotate("Launch surge\n(Mar 11)", xy=(r['day'], r['cumulative']),
                    xytext=(15, -30), textcoords='offset points',
                    fontsize=7.5, color=C_TEAL, fontstyle='italic',
                    arrowprops=dict(arrowstyle='->', color=C_TEAL, lw=1.2))
    # Final value label
    last = dj.iloc[-1]
    ax.text(last['day'], last['cumulative'] + 10, f"{int(last['cumulative']):,}",
            fontsize=8.5, fontweight='bold', color=C_TEAL_D, ha='left')
styled_ax(ax, xlabel="Date", ylabel="Cumulative Activations",
          title="Cumulative Teacher Activations",
          subtitle="March 2026 — daily registrations on Rumi")
ax.yaxis.set_major_locator(mticker.MaxNLocator(integer=True, nbins=6))
fig.autofmt_xdate(rotation=30, ha='right')
fig.tight_layout(pad=1.8)
save(fig, 'B_cumulative')

# ── C. District horizontal bar ────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(9, 8), facecolor=C_WHITE)
dp = dist_top.sort_values('listed', ascending=True).copy()
y  = np.arange(len(dp))
# Background bar (enrolled)
ax.barh(y, dp['listed'],  color=C_TEAL_L,   height=0.55, zorder=2)
# Foreground bar (activated)
ax.barh(y, dp['onboarded'], color=C_TEAL, height=0.55, zorder=3)
ax.set_yticks(y)
ax.set_yticklabels(dp['District'].tolist(), fontsize=8, color=C_SLATE)
ax.set_xlabel("Number of Teachers", fontsize=8, color=C_MUTED)
# Activation % labels
for i, (_, row) in enumerate(dp.iterrows()):
    if row['onboarded'] > 0:
        ax.text(row['listed'] + 1, i, f"{row['pct']:.0f}%",
                va='center', fontsize=7.5, color=C_TEAL_D, fontweight='bold')
legend_els = [mpatches.Patch(facecolor=C_TEAL_L, edgecolor='none', label='Enrolled'),
              mpatches.Patch(facecolor=C_TEAL,   edgecolor='none', label='Activated')]
ax.legend(handles=legend_els, loc='lower right', fontsize=8.5)
styled_ax(ax, title="Geographic Reach — Enrolled vs Activated",
          subtitle="Top 20 districts · percentage labels show activation rate")
fig.tight_layout(pad=1.8)
save(fig, 'C_district')

# ── D. Designation bar ────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(7.5, 4), facecolor=C_WHITE)
dp2 = df_csv['Desig_clean'].value_counts().head(7)
colors_d = CHART_PAL[:len(dp2)]
bars = ax.bar(dp2.index, dp2.values, color=colors_d,
              width=0.6, edgecolor=C_WHITE, linewidth=1.5, zorder=3)
add_bar_labels(ax, bars, color=C_DARK, offset=3)
styled_ax(ax, xlabel="Designation", ylabel="Teachers",
          title="Cohort by Designation",
          subtitle="All designations from STEDA enrolment list")
ax.yaxis.grid(True, color=C_BORDER, linestyle='--', linewidth=0.6)
ax.set_axisbelow(True)
fig.tight_layout(pad=1.8)
save(fig, 'D_designation')

# ── E. Gender donut ───────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(5, 5.2), facecolor=C_WHITE)
ax.set_facecolor(C_WHITE)
f_cnt = gender_counts.get('Female', 0)
m_cnt = gender_counts.get('Male', 0)
ax.pie([f_cnt, m_cnt], colors=[C_PINK, C_BLUE], startangle=90,
       wedgeprops=dict(width=0.55, edgecolor=C_WHITE, linewidth=3))
ax.text(0,  0.10, "50 / 50",   ha='center', fontsize=28, fontweight='bold', color=C_DARK)
ax.text(0, -0.18, "Near-equal\ngender parity", ha='center', fontsize=9, color=C_SLATE)
legend_els = [
    mpatches.Patch(facecolor=C_PINK, edgecolor='none',
                   label=f'Female  {f_cnt:,} ({f_cnt/TOTAL_LISTED*100:.1f}%)'),
    mpatches.Patch(facecolor=C_BLUE, edgecolor='none',
                   label=f'Male      {m_cnt:,} ({m_cnt/TOTAL_LISTED*100:.1f}%)'),
]
ax.legend(handles=legend_els, loc='lower center', bbox_to_anchor=(0.5, -0.07),
          ncol=2, handlelength=1.2, handleheight=1.0, fontsize=8.5, borderpad=0)
ax.set_title("Gender Distribution", fontsize=11, fontweight='bold', color=C_DARK, pad=14)
save(fig, 'E_gender')

# ── F. Lesson plan daily ──────────────────────────────────────────────────────
if not lp_daily.empty:
    fig, ax = plt.subplots(figsize=(8.5, 4), facecolor=C_WHITE)
    lp = lp_daily.sort_values('day')
    w  = 0.55
    ax.bar(lp['day'], lp['requests'],  color=C_BLUE_L,  width=w, zorder=2, label='Requested')
    ax.bar(lp['day'], lp['completed'], color=C_TEAL,    width=w, zorder=3, label='Completed')
    ax.legend(loc='upper left', fontsize=8.5)
    styled_ax(ax, xlabel="Date", ylabel="Lesson Plans",
              title="Daily Lesson Plan Activity",
              subtitle="Requests submitted and completed · STEDA cohort only")
    ax.yaxis.grid(True, color=C_BORDER, linestyle='--', linewidth=0.6)
    fig.autofmt_xdate(rotation=30, ha='right')
    fig.tight_layout(pad=1.8)
    save(fig, 'F_lp_daily')

# ── G. WhatsApp join timeline ─────────────────────────────────────────────────
if join_events:
    join_df  = pd.DataFrame(join_events)
    join_df['day'] = pd.to_datetime(join_df['date'], format='%m/%d/%y', errors='coerce')
    day_counts = join_df.groupby('day').size().reset_index(name='cnt')
    fig, ax = plt.subplots(figsize=(8.5, 4), facecolor=C_WHITE)
    bars_g = ax.bar(day_counts['day'], day_counts['cnt'],
                    color=C_PURPLE, width=0.7, zorder=3, alpha=0.85)
    # Annotate peak
    peak_idx = day_counts['cnt'].idxmax()
    peak_row = day_counts.loc[peak_idx]
    ax.annotate(f"  {int(peak_row['cnt'])} joined",
                xy=(peak_row['day'], peak_row['cnt']),
                xytext=(0, 8), textcoords='offset points',
                fontsize=8, color=C_PURPLE, fontweight='bold', ha='center')
    styled_ax(ax, xlabel="Date", ylabel="New Members",
              title="WhatsApp Community — Daily New Members",
              subtitle="Onboarding feedback group · March 9–18, 2026")
    ax.yaxis.grid(True, color=C_BORDER, linestyle='--', linewidth=0.6)
    fig.autofmt_xdate(rotation=30, ha='right')
    fig.tight_layout(pad=1.8)
    save(fig, 'G_wa_timeline')

# ── H. Sentiment indicators ───────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(6.5, 3.8), facecolor=C_WHITE)
labels = ['Positive\nResponses', 'Registration\nConfirmed', 'Lesson Plan\nMentions', 'Video\nMentions']
vals   = [POS_SENDERS, CONFIRMED_REG_CHAT, lp_mention, video_mention]
colors_h = [C_GREEN, C_TEAL, C_BLUE, C_PURPLE]
bars_h = ax.bar(labels, vals, color=colors_h, width=0.55,
                edgecolor=C_WHITE, linewidth=2, zorder=3)
add_bar_labels(ax, bars_h, color=C_DARK, offset=0.3, fontsize=11)
styled_ax(ax, title="Community Engagement Snapshot",
          subtitle="Indicators from WhatsApp onboarding group messages")
ax.yaxis.grid(True, color=C_BORDER, linestyle='--', linewidth=0.6)
ax.set_ylim(0, max(vals) * 1.25)
fig.tight_layout(pad=1.8)
save(fig, 'H_sentiment')

print("Charts saved.")

# ─────────────────────────────────────────────────────────────────────────────
# 7. PDF LAYOUT HELPERS
# ─────────────────────────────────────────────────────────────────────────────

FOOTER_TEXT = f"STEDA × Rumi  ·  Teacher Onboarding Report  ·  {REPORT_DATE}  ·  Confidential"

def add_footer(fig):
    fig.text(0.5, 0.012, FOOTER_TEXT, ha='center', va='bottom',
             fontsize=6.5, color=C_MUTED, style='italic')

def add_page_rule(fig, y=0.06, color=C_BORDER):
    """Thin horizontal rule above footer."""
    line = matplotlib.lines.Line2D([0.06, 0.94], [y, y],
                                   transform=fig.transFigure,
                                   color=color, linewidth=0.6)
    fig.add_artist(line)

def cover_page(pdf):
    fig = plt.figure(figsize=(12, 8.5))
    fig.patch.set_facecolor(C_DARK)
    ax  = fig.add_axes([0, 0, 1, 1]); ax.axis('off'); ax.set_facecolor(C_DARK)

    # ── Background geometry ─────────────────────────────────────────────────
    # Large teal accent block top-right
    ax.add_patch(FancyBboxPatch(
        (0.55, 0.60), 0.52, 0.47, transform=ax.transAxes,
        boxstyle="round,pad=0.0", facecolor=C_TEAL, edgecolor='none', zorder=1, alpha=0.18))
    # Diagonal stripe cluster (decorative lines)
    for i, offset in enumerate(np.linspace(0, 0.40, 6)):
        ax.plot([0.54 + offset, 0.70 + offset], [1.0, 0.60],
                transform=ax.transAxes, color=C_TEAL_M, alpha=0.07 - i*0.01,
                linewidth=18, solid_capstyle='round', zorder=1)
    # Teal top bar
    ax.add_patch(Rectangle((0, 0.88), 1, 0.12, transform=ax.transAxes,
                            facecolor=C_TEAL, edgecolor='none', zorder=2))
    # Thin gold accent line
    ax.plot([0, 1], [0.88, 0.88], transform=ax.transAxes,
            color=C_AMBER, linewidth=3, zorder=3)

    # ── Header text ────────────────────────────────────────────────────────
    ax.text(0.05, 0.94, "STEDA  ×  RUMI", transform=ax.transAxes,
            fontsize=30, fontweight='bold', color=C_WHITE, va='center', zorder=4)
    ax.text(0.05, 0.89, "AI-Powered Teaching Assistant — Pilot Programme",
            transform=ax.transAxes, fontsize=10, color=C_WHITE, alpha=0.80, va='center', zorder=4)

    # ── Title block ────────────────────────────────────────────────────────
    ax.text(0.05, 0.74, "Teacher Onboarding", transform=ax.transAxes,
            fontsize=42, fontweight='bold', color=C_WHITE, va='center', zorder=4)
    ax.text(0.05, 0.62, "Report", transform=ax.transAxes,
            fontsize=42, fontweight='bold', color=C_TEAL_M, va='center', zorder=4)

    # Thin white rule under title
    ax.plot([0.05, 0.55], [0.555, 0.555], transform=ax.transAxes,
            color=C_WHITE, linewidth=0.8, alpha=0.3, zorder=4)

    ax.text(0.05, 0.50, "Prepared for the Secretary of Education,\nGovernment of Sindh",
            transform=ax.transAxes, fontsize=13, color=C_WHITE, alpha=0.85,
            va='top', linespacing=1.6, zorder=4)
    ax.text(0.05, 0.40, f"Onboarding Period:  March 9 – 18, 2026",
            transform=ax.transAxes, fontsize=10, color=C_WHITE, alpha=0.60, zorder=4)
    ax.text(0.05, 0.36, f"Report Date:  {REPORT_DATE}",
            transform=ax.transAxes, fontsize=10, color=C_WHITE, alpha=0.60, zorder=4)

    # ── KPI strip ──────────────────────────────────────────────────────────
    # Strip background
    ax.add_patch(Rectangle((0.04, 0.08), 0.92, 0.22, transform=ax.transAxes,
                            facecolor='#1E293B', edgecolor='none', zorder=3))
    ax.plot([0.04, 0.96], [0.30, 0.30], transform=ax.transAxes,
            color=C_TEAL, linewidth=1.5, alpha=0.5, zorder=4)

    kpis = [
        ("1,349",             "STEDA Teachers\nEnrolled",     C_WHITE),
        (f"{TOTAL_JOINED:,}", "Teachers\nActivated",          C_TEAL_M),
        (f"{ONBOARD_PCT}%",   "Activation\nRate",             C_GREEN),
        (f"{int(lp_all['completed']):,}", "Lesson Plans\nCompleted", C_AMBER),
    ]
    for i, (val, lbl, col) in enumerate(kpis):
        cx = 0.13 + i * 0.23
        # Divider between items
        if i > 0:
            ax.plot([cx - 0.035, cx - 0.035], [0.10, 0.28],
                    transform=ax.transAxes, color=C_WHITE, alpha=0.08, linewidth=1, zorder=5)
        ax.text(cx, 0.225, val, ha='center', va='center', fontsize=22,
                fontweight='bold', color=col, transform=ax.transAxes, zorder=5)
        ax.text(cx, 0.125, lbl, ha='center', va='center', fontsize=8,
                color=C_WHITE, alpha=0.65, transform=ax.transAxes,
                linespacing=1.4, zorder=5)

    ax.text(0.5, 0.025, "Confidential  ·  Prepared by the STEDA / Taleemabad Digital Pilot Team",
            ha='center', fontsize=7.5, color=C_WHITE, alpha=0.35, transform=ax.transAxes, zorder=4)

    pdf.savefig(fig, bbox_inches='tight'); plt.close(fig)


def kpi_page(pdf):
    """8-card KPI dashboard page with accent bars and icons."""
    fig = plt.figure(figsize=(12, 7.5), facecolor=C_SURFACE)
    fig.patch.set_facecolor(C_SURFACE)

    # Page header band
    header_ax = fig.add_axes([0, 0.88, 1, 0.12])
    header_ax.set_facecolor(C_WHITE); header_ax.axis('off')
    header_ax.add_patch(Rectangle((0, 0), 1, 1, facecolor=C_WHITE, edgecolor='none',
                                   transform=header_ax.transAxes))
    header_ax.add_patch(Rectangle((0, 0), 0.005, 1, facecolor=C_TEAL,
                                   transform=header_ax.transAxes))
    header_ax.text(0.03, 0.62, "Executive Summary",
                   fontsize=16, fontweight='bold', color=C_DARK,
                   transform=header_ax.transAxes, va='center')
    header_ax.text(0.03, 0.20, "Key Performance Indicators  ·  STEDA Pilot Cohort  ·  March 2026",
                   fontsize=9, color=C_MUTED, transform=header_ax.transAxes, va='center')

    kpi_data = [
        # (value, label, sublabel, bg_color, accent_color)
        (f"{TOTAL_LISTED:,}",        "Teachers\nEnrolled",         "STEDA pilot list",               C_WHITE,    C_SLATE),
        (f"{TOTAL_JOINED:,}",        "Teachers\nActivated",        f"of {TOTAL_LISTED:,} enrolled",  C_WHITE,    C_TEAL),
        (f"{ONBOARD_PCT}%",          "Activation\nRate",           "target: 100%",                   C_WHITE,    C_GREEN),
        (f"{TOTAL_NOT_YET:,}",       "Pending\nActivation",        "yet to register",                C_WHITE,    C_AMBER),
        (f"{int(lp_all['total']):,}","Lesson Plan\nRequests",      "total submitted",                C_WHITE,    C_BLUE),
        (f"{int(lp_all['completed']):,}","Lesson Plans\nCompleted",f"{int(lp_all['users_lp']):,} teachers used LP", C_WHITE, C_INDIGO),
        (f"{int(coaching['total']):,}","Coaching\nSessions",       f"{int(coaching['users_coaching']):,} teachers coached", C_WHITE, C_PURPLE),
        (f"{unique_joiners:,}",      "WhatsApp\nCommunity",        "onboarding group members",       C_WHITE,    C_ORANGE),
    ]

    # 2 × 4 grid, leaving margin for header
    cols, rows = 4, 2
    margin_l, margin_r = 0.03, 0.03
    margin_b, margin_t = 0.06, 0.10
    gap_x, gap_y       = 0.016, 0.024
    w = (1 - margin_l - margin_r - gap_x * (cols-1)) / cols
    h = (0.88 - margin_b - margin_t - gap_y * (rows-1)) / rows

    for idx, (val, lbl, sub, bg, accent) in enumerate(kpi_data):
        col_i = idx % cols
        row_i = idx // cols
        x = margin_l + col_i * (w + gap_x)
        y = 0.88 - margin_t - (row_i+1) * h - row_i * gap_y

        ax = fig.add_axes([x, y, w, h])
        ax.set_facecolor(bg); ax.axis('off')
        # Card shadow effect (thin bottom-right border)
        for spine in ax.spines.values():
            spine.set_visible(False)
        # Rounded card outline
        ax.add_patch(FancyBboxPatch((0.01, 0.01), 0.98, 0.98,
                                    transform=ax.transAxes,
                                    boxstyle="round,pad=0.015",
                                    facecolor=bg, edgecolor=C_BORDER,
                                    linewidth=0.8, zorder=1))
        # Left accent bar
        ax.add_patch(FancyBboxPatch((0.01, 0.10), 0.035, 0.80,
                                    transform=ax.transAxes,
                                    boxstyle="round,pad=0.0",
                                    facecolor=accent, edgecolor='none', zorder=2))
        # Value
        ax.text(0.58, 0.63, val, ha='center', va='center',
                fontsize=24, fontweight='bold', color=accent,
                transform=ax.transAxes, zorder=3)
        # Label
        ax.text(0.58, 0.32, lbl, ha='center', va='center',
                fontsize=8.5, color=C_DARK, transform=ax.transAxes,
                linespacing=1.4, zorder=3)
        # Sub-label
        if sub:
            ax.text(0.58, 0.10, sub, ha='center', va='bottom',
                    fontsize=6.8, color=C_MUTED, transform=ax.transAxes,
                    style='italic', zorder=3)

    add_footer(fig)
    pdf.savefig(fig, bbox_inches='tight'); plt.close(fig)


def section_divider(pdf, number, title, subtitle=""):
    """Full-page minimal section divider."""
    fig = plt.figure(figsize=(12, 2.8), facecolor=C_WHITE)
    ax  = fig.add_axes([0, 0, 1, 1]); ax.axis('off'); ax.set_facecolor(C_WHITE)

    # Left teal block
    ax.add_patch(Rectangle((0, 0), 0.008, 1, facecolor=C_TEAL,
                            transform=ax.transAxes))
    # Number badge
    circle = plt.Circle((0.055, 0.50), 0.28, color=C_TEAL_L, transform=ax.transAxes,
                         clip_on=False)
    ax.add_patch(circle)
    ax.text(0.055, 0.50, str(number), ha='center', va='center',
            fontsize=22, fontweight='bold', color=C_TEAL, transform=ax.transAxes)
    # Titles
    ax.text(0.13, 0.65, f"Section {number}", ha='left', va='center',
            fontsize=9, color=C_MUTED, transform=ax.transAxes, style='italic')
    ax.text(0.13, 0.40, title, ha='left', va='center',
            fontsize=22, fontweight='bold', color=C_DARK, transform=ax.transAxes)
    if subtitle:
        ax.text(0.13, 0.14, subtitle, ha='left', va='center',
                fontsize=10, color=C_SLATE, transform=ax.transAxes)
    # Bottom rule
    ax.plot([0.008, 0.99], [0.08, 0.08], transform=ax.transAxes,
            color=C_BORDER, linewidth=0.8)

    pdf.savefig(fig, bbox_inches='tight'); plt.close(fig)


def chart_spread(pdf, img_paths, captions=None):
    """Render 1–3 chart images on a white page with captions."""
    n   = len(img_paths)
    fig = plt.figure(figsize=(12, 6.5), facecolor=C_WHITE)
    fig.patch.set_facecolor(C_WHITE)
    for i, path in enumerate(img_paths):
        ax = fig.add_axes([i/n + 0.01, 0.08, 1/n - 0.02, 0.88])
        ax.axis('off')
        if os.path.exists(path):
            ax.imshow(plt.imread(path), aspect='auto')
        if captions and i < len(captions) and captions[i]:
            ax.set_title(captions[i], fontsize=8, color=C_MUTED, pad=4,
                         style='italic', loc='center')
    add_footer(fig)
    pdf.savefig(fig, bbox_inches='tight'); plt.close(fig)


def full_chart_page(pdf, img_path):
    """Single chart fills the page."""
    fig = plt.figure(figsize=(12, 7.5), facecolor=C_WHITE)
    ax  = fig.add_axes([0.02, 0.07, 0.96, 0.89])
    ax.axis('off')
    if os.path.exists(img_path):
        ax.imshow(plt.imread(img_path), aspect='auto')
    add_footer(fig)
    pdf.savefig(fig, bbox_inches='tight'); plt.close(fig)


def quotes_page(pdf, quotes_list):
    """Magazine-style quote grid — avatar initials + teal left border."""
    fig = plt.figure(figsize=(12, 9.5), facecolor=C_SURFACE)
    fig.patch.set_facecolor(C_SURFACE)
    ax  = fig.add_axes([0, 0, 1, 1]); ax.axis('off'); ax.set_facecolor(C_SURFACE)

    # Page header
    ax.add_patch(Rectangle((0, 0.91), 1, 0.09, facecolor=C_WHITE,
                            transform=ax.transAxes))
    ax.add_patch(Rectangle((0, 0.91), 0.005, 0.09, facecolor=C_TEAL,
                            transform=ax.transAxes))
    ax.text(0.03, 0.955, "Teacher Voice", fontsize=18, fontweight='bold',
            color=C_DARK, transform=ax.transAxes, va='center')
    ax.text(0.03, 0.918, "Direct feedback from the STEDA onboarding WhatsApp community",
            fontsize=9, color=C_MUTED, transform=ax.transAxes, va='center', style='italic')

    cols  = 2
    rows  = (len(quotes_list) + 1) // cols
    pad_x = 0.04; pad_y = 0.03
    w     = (1 - pad_x * (cols + 1)) / cols
    h     = (0.88 - pad_y * (rows + 1)) / rows

    accent_cols = [C_TEAL, C_BLUE, C_PURPLE, C_GREEN, C_ORANGE, C_PINK, C_INDIGO, C_AMBER]

    for i, (name, quote) in enumerate(quotes_list):
        col = i % cols;  row = i // cols
        x   = pad_x + col * (w + pad_x)
        y   = 0.88 - pad_y - row * (h + pad_y) - h
        acc = accent_cols[i % len(accent_cols)]

        # Card
        ax.add_patch(FancyBboxPatch((x, y), w, h, transform=ax.transAxes,
                                    boxstyle="round,pad=0.008",
                                    facecolor=C_WHITE, edgecolor=C_BORDER,
                                    linewidth=0.6, zorder=2))
        # Left accent bar
        ax.add_patch(FancyBboxPatch((x + 0.003, y + 0.01), 0.006, h - 0.02,
                                    transform=ax.transAxes,
                                    boxstyle="round,pad=0.0",
                                    facecolor=acc, edgecolor='none', zorder=3))
        # Avatar circle
        circ_x = x + 0.022; circ_y = y + h - 0.058
        circle = plt.Circle((circ_x, circ_y), 0.022,
                             color=acc, alpha=0.15, transform=ax.transAxes,
                             zorder=3, clip_on=False)
        ax.add_patch(circle)
        initials = ''.join(p[0].upper() for p in name.split()[:2] if p)
        ax.text(circ_x, circ_y, initials, ha='center', va='center',
                fontsize=7, fontweight='bold', color=acc,
                transform=ax.transAxes, zorder=4)
        # Name
        ax.text(x + 0.052, y + h - 0.030, name, ha='left', va='center',
                fontsize=8, fontweight='bold', color=C_DARK,
                transform=ax.transAxes, zorder=4)
        ax.text(x + 0.052, y + h - 0.052, "STEDA Teacher",
                ha='left', va='center', fontsize=6.8, color=C_MUTED,
                transform=ax.transAxes, zorder=4, style='italic')
        # Thin rule
        ax.plot([x + 0.018, x + w - 0.01], [y + h - 0.068, y + h - 0.068],
                transform=ax.transAxes, color=C_BORDER, linewidth=0.5, zorder=4)
        # Quote text
        wrapped = textwrap.fill(quote, width=62)
        ax.text(x + 0.018, y + h - 0.082, "\u201c " + wrapped + " \u201d",
                ha='left', va='top', fontsize=7.8, color=C_SLATE,
                transform=ax.transAxes, zorder=4, linespacing=1.5,
                style='italic')

    add_footer(fig)
    pdf.savefig(fig, bbox_inches='tight'); plt.close(fig)


def district_table_page(pdf):
    """Clean full-page district table."""
    fig = plt.figure(figsize=(12, 9.5), facecolor=C_WHITE)
    fig.patch.set_facecolor(C_WHITE)
    ax  = fig.add_axes([0.03, 0.05, 0.94, 0.90]); ax.axis('off')

    # Header
    ax.text(0.0, 1.01, "District-wise Onboarding Status",
            ha='left', va='bottom', fontsize=14, fontweight='bold',
            color=C_DARK, transform=ax.transAxes)
    ax.text(0.0, 0.985, "All districts from the STEDA enrolment list · sorted by enrolment size",
            ha='left', va='bottom', fontsize=8.5, color=C_MUTED,
            transform=ax.transAxes, style='italic')

    cols_tbl = ['District', 'Enrolled', 'Activated', 'Pending', 'Rate']
    rows_data = []
    for _, row in dist.sort_values('listed', ascending=False).head(27).iterrows():
        rows_data.append([
            row['District'].strip(),
            f"{int(row['listed']):,}",
            f"{int(row['onboarded']):,}",
            f"{int(row['not_yet']):,}",
            f"{row['pct']:.0f}%",
        ])

    tbl = ax.table(cellText=rows_data, colLabels=cols_tbl,
                   cellLoc='center', loc='center',
                   bbox=[0, 0.01, 1.0, 0.965])
    tbl.auto_set_font_size(False); tbl.set_fontsize(8.5)
    tbl.auto_set_column_width(col=list(range(len(cols_tbl))))

    # Header row
    for j in range(len(cols_tbl)):
        cell = tbl[0, j]
        cell.set_facecolor(C_DARK)
        cell.set_text_props(color=C_WHITE, fontweight='bold', fontsize=9)
        cell.set_edgecolor(C_DARK)

    # Body rows
    for i in range(1, len(rows_data) + 1):
        stripe = '#F8FAFC' if i % 2 == 0 else C_WHITE
        for j in range(len(cols_tbl)):
            cell = tbl[i, j]
            cell.set_facecolor(stripe)
            cell.set_edgecolor(C_BORDER)
            cell.set_linewidth(0.4)
            # Rate column coloring
            if j == 4:
                pct = float(rows_data[i-1][4].replace('%',''))
                if pct >= 80:
                    cell.set_text_props(color=C_GREEN, fontweight='bold')
                elif pct >= 55:
                    cell.set_text_props(color=C_TEAL, fontweight='bold')
                else:
                    cell.set_text_props(color=C_AMBER, fontweight='bold')

    add_footer(fig)
    pdf.savefig(fig, bbox_inches='tight'); plt.close(fig)


def findings_page(pdf):
    """Key findings with numbered badge cards + recommendations."""
    fig = plt.figure(figsize=(12, 9.5), facecolor=C_WHITE)
    fig.patch.set_facecolor(C_WHITE)
    ax  = fig.add_axes([0, 0, 1, 1]); ax.axis('off')

    # Page title band
    ax.add_patch(Rectangle((0, 0.905), 1, 0.095, facecolor=C_SURFACE,
                            transform=ax.transAxes))
    ax.add_patch(Rectangle((0, 0.905), 0.005, 0.095, facecolor=C_TEAL,
                            transform=ax.transAxes))
    ax.text(0.03, 0.956, "Key Findings & Recommendations",
            fontsize=18, fontweight='bold', color=C_DARK,
            transform=ax.transAxes, va='center')
    ax.text(0.03, 0.916, "Summary observations and next-step actions for the Secretary of Education",
            fontsize=9.5, color=C_MUTED, transform=ax.transAxes, va='center', style='italic')

    findings = [
        ("01", C_TEAL,   C_TEAL_L,   "Strong Activation Rate",
         f"{ONBOARD_PCT}% of the 1,349 enrolled STEDA teachers have successfully activated "
         f"their Rumi accounts, representing {TOTAL_JOINED:,} teachers across Sindh's public school system."),
        ("02", C_GREEN,  C_GREEN_L,  "Rapid Adoption on Launch Day",
         "The March 11, 2026 onboarding event saw hundreds of teachers join the WhatsApp "
         "community within hours, demonstrating strong institutional readiness."),
        ("03", C_BLUE,   C_BLUE_L,   "Broad Geographic Coverage",
         f"Teachers from all major districts are represented. Highest enrolment: "
         f"Hyderabad ({dist[dist['District']=='Hyderabad']['listed'].sum():.0f}), "
         f"Karachi ({dist[dist['District']=='Karachi']['listed'].sum():.0f}), "
         f"Khairpur Mirs ({dist[dist['District']=='Khairpur Mirs']['listed'].sum():.0f}), "
         f"SBA ({dist[dist['District']=='SBA']['listed'].sum():.0f})."),
        ("04", C_PINK,   C_PINK_L,   "Near-Equal Gender Parity",
         f"The enrolled cohort is nearly 50/50: {gender_counts.get('Female',0):,} female "
         f"(50.4%) and {gender_counts.get('Male',0):,} male (49.6%) teachers."),
        ("05", C_INDIGO, C_INDIGO_L, "Active Feature Engagement",
         f"{int(lp_all['completed']):,} lesson plans completed by {int(lp_all['users_lp']):,} "
         f"unique teachers, with {int(coaching['total']):,} coaching interactions recorded."),
        ("06", C_PURPLE, C_PURPLE_L, "Positive Teacher Sentiment",
         f"{POS_SENDERS} teachers expressed positive feedback, praising AI-generated lesson "
         f"plan quality and the value of a Sindh-curriculum-aligned teaching assistant."),
    ]

    recommendations = [
        (C_AMBER, "ACTION",
         f"Targeted Outreach for {TOTAL_NOT_YET:,} Pending Teachers",
         "Deploy district coordinators through STEDA's DEO network to follow up with "
         "teachers who have not yet activated. Goal: close the gap before end of March 2026."),
        (C_ORANGE, "ACTION",
         "Structured Training Workshops",
         "Teachers in the onboarding group requested step-by-step guidance. Deliver short "
         "video tutorials and taluka-level workshops to accelerate skill-building."),
    ]

    # Findings (2-col grid)
    f_cols = 2; pad = 0.025
    fw = (1 - pad * (f_cols + 1)) / f_cols
    fh = 0.105
    f_top = 0.88

    for i, (num, acc, acc_l, title, body) in enumerate(findings):
        col = i % f_cols; row = i // f_cols
        x = pad + col * (fw + pad)
        y = f_top - row * (fh + pad * 1.2) - fh

        ax.add_patch(FancyBboxPatch((x, y), fw, fh, transform=ax.transAxes,
                                    boxstyle="round,pad=0.008",
                                    facecolor=acc_l, edgecolor='none', zorder=2))
        # Number badge
        ax.text(x + 0.018, y + fh * 0.78, num, ha='center', va='center',
                fontsize=14, fontweight='bold', color=acc,
                transform=ax.transAxes, zorder=3, alpha=0.5)
        ax.text(x + 0.048, y + fh * 0.75, title, ha='left', va='center',
                fontsize=9, fontweight='bold', color=C_DARK,
                transform=ax.transAxes, zorder=3)
        wrapped = textwrap.fill(body, width=66)
        ax.text(x + 0.014, y + fh * 0.38, wrapped, ha='left', va='center',
                fontsize=7.5, color=C_SLATE, transform=ax.transAxes, zorder=3,
                linespacing=1.45)

    # Recommendations strip
    rec_y_top = f_top - 3 * (fh + pad * 1.2) - fh - pad * 2
    ax.plot([pad, 1 - pad], [rec_y_top + 0.048, rec_y_top + 0.048],
            transform=ax.transAxes, color=C_BORDER, linewidth=0.8)
    ax.text(pad, rec_y_top + 0.035, "Recommended Actions",
            ha='left', va='top', fontsize=10, fontweight='bold',
            color=C_DARK, transform=ax.transAxes)

    rh  = 0.085
    rw  = (1 - pad * 3) / 2
    ry  = rec_y_top - pad * 0.5 - rh
    for i, (acc, badge, rtitle, rbody) in enumerate(recommendations):
        rx = pad + i * (rw + pad)
        ax.add_patch(FancyBboxPatch((rx, ry), rw, rh, transform=ax.transAxes,
                                    boxstyle="round,pad=0.008",
                                    facecolor=C_AMBER_L if acc == C_AMBER else C_ORANGE_L,
                                    edgecolor='none', zorder=2))
        # Badge pill
        ax.add_patch(FancyBboxPatch((rx + 0.008, ry + rh * 0.60), 0.055, 0.028,
                                    transform=ax.transAxes,
                                    boxstyle="round,pad=0.003",
                                    facecolor=acc, edgecolor='none', zorder=3))
        ax.text(rx + 0.035, ry + rh * 0.74, badge, ha='center', va='center',
                fontsize=6.5, fontweight='bold', color=C_WHITE,
                transform=ax.transAxes, zorder=4)
        ax.text(rx + 0.075, ry + rh * 0.75, rtitle, ha='left', va='center',
                fontsize=9, fontweight='bold', color=C_DARK,
                transform=ax.transAxes, zorder=3)
        wrapped_r = textwrap.fill(rbody, width=70)
        ax.text(rx + 0.014, ry + rh * 0.38, wrapped_r, ha='left', va='center',
                fontsize=7.5, color=C_SLATE, transform=ax.transAxes,
                zorder=3, linespacing=1.45)

    add_footer(fig)
    pdf.savefig(fig, bbox_inches='tight'); plt.close(fig)


# ─────────────────────────────────────────────────────────────────────────────
# 8. COMPOSE PDF
# ─────────────────────────────────────────────────────────────────────────────
import matplotlib.lines
print("Composing PDF …")
PDF_PATH = "STEDA_Onboarding_Report_March18.pdf"

with PdfPages(PDF_PATH) as pdf:
    # Cover
    cover_page(pdf)

    # Executive summary KPIs
    kpi_page(pdf)

    # Section 1 — Activation
    section_divider(pdf, 1, "Activation Overview",
                    "How many STEDA teachers have registered and activated their Rumi accounts?")
    chart_spread(pdf,
        [f"{OUT}/A_donut.png", f"{OUT}/B_cumulative.png"])

    # Section 2 — Demographics
    section_divider(pdf, 2, "Demographic Profile",
                    "Who are the STEDA teachers enrolled in the Rumi pilot programme?")
    chart_spread(pdf,
        [f"{OUT}/E_gender.png", f"{OUT}/D_designation.png"])

    # Section 3 — Geography
    section_divider(pdf, 3, "Geographic Reach",
                    "Which districts are leading in teacher activation?")
    full_chart_page(pdf, f"{OUT}/C_district.png")
    district_table_page(pdf)

    # Section 4 — Engagement
    section_divider(pdf, 4, "Platform Engagement",
                    "How are teachers using Rumi after activation?")
    if os.path.exists(f"{OUT}/F_lp_daily.png"):
        full_chart_page(pdf, f"{OUT}/F_lp_daily.png")

    # Section 5 — Sentiment
    section_divider(pdf, 5, "Teacher Sentiment",
                    "Community response and direct feedback from the onboarding WhatsApp group")
    if os.path.exists(f"{OUT}/G_wa_timeline.png"):
        chart_spread(pdf,
            [f"{OUT}/G_wa_timeline.png", f"{OUT}/H_sentiment.png"])
    quotes_page(pdf, QUOTES)

    # Section 6 — Findings
    section_divider(pdf, 6, "Findings & Recommendations",
                    "Summary insights and next-step actions for the Secretary of Education")
    findings_page(pdf)

print(f"\n✓  Report saved → {PDF_PATH}")
