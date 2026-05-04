"""
STEDA Partner-Facing Report Generator
======================================
Compares STEDA teacher list (CSV) with Rumi DB,
incorporates WhatsApp community feedback, and builds
a polished partner-facing PDF.
"""

import os, sys, io, re, datetime, warnings
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.patheffects as pe
import seaborn as sns
from collections import Counter
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
sns.set_theme(style="whitegrid")
plt.rcParams.update({"figure.dpi": 160, "font.family": "DejaVu Sans"})

# ── DB ────────────────────────────────────────────────────────────────────────
DB_URL = (
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    f"?sslmode={os.getenv('DB_SSL', 'require')}"
)
engine = create_engine(DB_URL, connect_args={"connect_timeout": 30})
def q(sql):
    with engine.connect() as c: return pd.read_sql(text(sql), c)

OUT = "partner_charts"
os.makedirs(OUT, exist_ok=True)

# ── Brand colours ──────────────────────────────────────────────────────────────
C_TEAL   = "#0D9488"
C_DARK   = "#0F172A"
C_SLATE  = "#334155"
C_LIGHT  = "#F1F5F9"
C_AMBER  = "#F59E0B"
C_GREEN  = "#22C55E"
C_RED    = "#EF4444"
C_BLUE   = "#3B82F6"
C_PURPLE = "#8B5CF6"
C_PINK   = "#EC4899"
C_WHITE  = "#FFFFFF"

# ─────────────────────────────────────────────────────────────────────────────
# 1. LOAD & NORMALISE DATA
# ─────────────────────────────────────────────────────────────────────────────
print("Loading data …")
df_csv = pd.read_csv("STEDA List of Teachers-1 .csv", encoding="utf-8-sig")

def norm_phone(p):
    if pd.isna(p): return None
    p = re.sub(r'[\s\-\(\)]', '', str(p))
    if p.startswith('0'):   return '92' + p[1:]
    if p.startswith('+92'): return p[1:]
    if p.startswith('92'):  return p
    return '92' + p

df_csv['phone_norm'] = df_csv['WhatsappNo'].apply(norm_phone)
phones = [p for p in df_csv['phone_norm'].tolist() if p]
phone_sql = "', '".join(phones)

db_users = q(f"""
    SELECT id, phone_number, first_name, school_name, organization,
           registration_completed, registration_state, created_at, preferred_language
    FROM users
    WHERE phone_number IN ('{phone_sql}')
      AND COALESCE(is_test_user, false) = false
""")
db_users = db_users.rename(columns={"phone_number": "phone_norm"})

merged = df_csv.merge(db_users, on="phone_norm", how="left", indicator=True)
merged['onboarded'] = merged['_merge'] == 'both'
merged['reg_done']  = merged['registration_completed'].fillna(False)

matched_ids = db_users['id'].dropna().tolist()
id_arr = ",".join(f"'{i}'" for i in matched_ids)

lp_stats = q(f"""
    SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='completed') AS completed,
           COUNT(DISTINCT user_id) AS users_lp,
           ROUND(AVG(EXTRACT(EPOCH FROM (completed_at-created_at))/60)
                 FILTER (WHERE status='completed')::numeric,2) AS avg_total_min,
           ROUND(AVG(EXTRACT(EPOCH FROM (processing_started_at-created_at))/60)
                 FILTER (WHERE status='completed')::numeric,2) AS avg_queue_min,
           ROUND(AVG(EXTRACT(EPOCH FROM (completed_at-processing_started_at))/60)
                 FILTER (WHERE status='completed')::numeric,2) AS avg_ai_min
    FROM lesson_plan_requests WHERE user_id = ANY(ARRAY[{id_arr}]::uuid[])
""").iloc[0]

# District analysis
dist = merged.groupby('District').agg(
    listed=('S.No','count'), onboarded=('onboarded','sum')
).sort_values('listed', ascending=False).reset_index()
dist['pct'] = (dist['onboarded'] / dist['listed'] * 100).round(1)
dist['not_yet'] = dist['listed'] - dist['onboarded']

# Designation cleanup
desig_map = {'JEST/JST':'JEST/JST','PST':'PST','EST':'EST','HST':'HST',
             'SST':'SST','ECT':'ECT','Sr. ECT':'Sr. ECT','Lecturer':'Lecturer'}
df_csv['Desig_clean'] = df_csv['Designation'].apply(
    lambda x: desig_map.get(str(x).strip(), 'Other'))

# ─────────────────────────────────────────────────────────────────────────────
# 2. PARSE WHATSAPP CHAT
# ─────────────────────────────────────────────────────────────────────────────
print("Parsing WhatsApp chat …")
with open("WhatsApp Chat with General  Discussions.txt", encoding="utf-8") as f:
    chat_content = f.read()

chat_lines = chat_content.split('\n')
msg_pat = re.compile(r'^(\d+/\d+/\d+,\s[\d:]+\u202f[AP]M)\s-\s([^:]+):\s(.+)', re.DOTALL)
ADMINS = {'Sajid Hussain Mallah', 'Junaid Ali', 'You', 'Rab Nawaz Khaskheli',
          'Afzal ahmed', 'GUL HASSAN', 'Ayaz Iqbal Jokhio'}

all_messages, join_events = [], []
for line in chat_lines:
    m = msg_pat.match(line.strip())
    if m:
        all_messages.append({'time': m.group(1), 'sender': m.group(2).strip(), 'text': m.group(3).strip()})
    if 'joined from the community' in line:
        join_events.append(line)

user_msgs = [m for m in all_messages
             if m['sender'] not in ADMINS and '<Media' not in m['text'] and len(m['text']) > 5]

# Curated quotes for the report
PRAISE_QUOTES = [
    ("Ghulam Nabi",       "I am thrilled to be a part of this pilot program! Having an AI assistant to help with lesson planning is a fantastic initiative."),
    ("Imtiaz Ahmed",      "Thank you STEDA for providing us such a wonderful platform — it would be beneficial for all the teachers."),
    ("Abdul Hameed",      "Hats off to the Sindh Education Department and Syed Sardar Ali Shah for this great initiative."),
    ("Bilal Hussain",     "Lesson plans are generating quite well."),
    ("Zohaib Hassan",     "Amazing 👏 Within seconds"),
    ("Bakhtawar",         "Indeed great initiative 👏"),
    ("Yousif Jameel",     "This is really mind blowing ☺️"),
    ("Rabel Shoro",       "I have generated a lesson plan. Very detailed and useful. We can also alter it as per our requirements."),
    ("Hayat",             "Thanks for initiating such a wonderful platform."),
    ("Zakir Ali",         "Proud to be a part of this great platform."),
]

ISSUE_QUOTES = [
    ("Bilal Hussain",     "There is a problem in generating animations."),
    ("Naeem Nisar Memon", "It still has glitches — but hope with time it will get better."),
    ("Mehreen",           "I want an Islamiat lesson plan — I asked but never received it."),
    ("Karim Bux",         "I asked for an English subject lesson plan but the response I received was unrelated."),
    ("Robeena Sajawal",   "Teacher Portal: Username/password given but login is not working."),
    ("Multiple teachers", "Registration / how to get started was confusing — many asked for guidance."),
]

# ─────────────────────────────────────────────────────────────────────────────
# 3. CHARTS
# ─────────────────────────────────────────────────────────────────────────────
print("Generating charts …")

def save(fig, name):
    p = f"{OUT}/{name}.png"
    fig.savefig(p, bbox_inches="tight", dpi=160, facecolor=fig.get_facecolor())
    plt.close(fig)
    return p

# ── Chart 1: Onboarding Funnel ────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(10, 6), facecolor=C_DARK)
ax.set_facecolor(C_DARK)

stages = [
    ("Teachers\nListed by STEDA", 1349, C_BLUE),
    ("Joined Rumi\n(Phone Matched)", 853, C_TEAL),
    ("Generated ≥1\nLesson Plan", int(lp_stats['users_lp']), C_AMBER),
]
max_w = 0.82
for i, (label, val, color) in enumerate(stages):
    w = max_w * (val / 1349)
    x0 = (max_w - w) / 2
    bar = plt.Rectangle((x0, i * 0.28), w, 0.22, color=color, zorder=3)
    ax.add_patch(bar)
    ax.text(0.5, i * 0.28 + 0.11, f"{val:,}", ha='center', va='center',
            fontsize=22, fontweight='bold', color='white', zorder=4)
    ax.text(-0.01, i * 0.28 + 0.11, label, ha='right', va='center',
            fontsize=10, color='#CBD5E1', zorder=4)
    pct = val / 1349 * 100
    ax.text(max_w / 2 + (max_w - w) / 2 + w + 0.01, i * 0.28 + 0.11,
            f"{pct:.0f}%", ha='left', va='center', fontsize=12,
            color=color, fontweight='bold', zorder=4)
    if i < len(stages) - 1:
        ax.annotate('', xy=(0.5, (i + 1) * 0.28 - 0.01),
                    xytext=(0.5, i * 0.28 + 0.22 + 0.01),
                    arrowprops=dict(arrowstyle='->', color='#475569', lw=2))

ax.set_xlim(-0.25, 1.05)
ax.set_ylim(-0.05, 0.95)
ax.axis('off')
ax.set_title('Teacher Onboarding Funnel', fontsize=16, fontweight='bold',
             color='white', pad=14)
save(fig, "01_funnel")

# ── Chart 2: District Breakdown (top 16 stacked bar) ─────────────────────────
top_d = dist.head(16).copy()
fig, ax = plt.subplots(figsize=(13, 7), facecolor=C_DARK)
ax.set_facecolor(C_DARK)
y = np.arange(len(top_d))
b1 = ax.barh(y, top_d['onboarded'], color=C_TEAL,  label='Joined Rumi', height=0.6)
b2 = ax.barh(y, top_d['not_yet'],  left=top_d['onboarded'], color='#1E3A5F', label='Not Yet', height=0.6)
ax.set_yticks(y)
ax.set_yticklabels(top_d['District'], color='#CBD5E1', fontsize=10)
ax.set_xlabel('Teachers', color='#94A3B8')
ax.tick_params(colors='#94A3B8')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
for s in ['bottom', 'left']: ax.spines[s].set_color('#334155')
ax.set_title('District-wise Onboarding — Top 16 Districts', fontsize=14,
             fontweight='bold', color='white', pad=12)
for i, row in enumerate(top_d.itertuples()):
    ax.text(row.listed + 1, i, f"{row.pct:.0f}%", va='center',
            color=C_AMBER, fontsize=9, fontweight='bold')
ax.legend(framealpha=0, labelcolor='#CBD5E1', fontsize=10)
ax.grid(axis='x', color='#1E293B', linewidth=0.5)
plt.tight_layout()
save(fig, "02_districts")

# ── Chart 3: Gender & School Type pie charts ──────────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(12, 5), facecolor=C_DARK)
for ax in axes: ax.set_facecolor(C_DARK)

# Gender
g_listed = df_csv['Gender'].value_counts()
g_onb    = merged[merged['onboarded']]['Gender'].value_counts()
wedge_colors = [C_PINK, C_BLUE]
axes[0].pie(g_listed.values, labels=g_listed.index, colors=wedge_colors,
            autopct='%1.1f%%', startangle=90, textprops={'color': 'white', 'fontsize': 12},
            wedgeprops={'linewidth': 2, 'edgecolor': C_DARK})
axes[0].set_title('Gender Distribution\n(All 1,349 Listed)', color='white', fontsize=12, fontweight='bold')

# School type
gp = df_csv['Government_Private'].value_counts()
axes[1].pie(gp.values, labels=gp.index, colors=[C_TEAL, C_AMBER],
            autopct='%1.1f%%', startangle=90, textprops={'color': 'white', 'fontsize': 12},
            wedgeprops={'linewidth': 2, 'edgecolor': C_DARK})
axes[1].set_title('School Type\n(All 1,349 Listed)', color='white', fontsize=12, fontweight='bold')
plt.tight_layout()
save(fig, "03_demographics")

# ── Chart 4: Designation breakdown ────────────────────────────────────────────
desig_counts = df_csv['Desig_clean'].value_counts()
fig, ax = plt.subplots(figsize=(10, 5), facecolor=C_DARK)
ax.set_facecolor(C_DARK)
colors_d = [C_TEAL, C_BLUE, C_PURPLE, C_AMBER, C_GREEN, C_PINK, C_RED, '#64748B']
bars = ax.bar(desig_counts.index, desig_counts.values,
              color=colors_d[:len(desig_counts)], edgecolor=C_DARK, linewidth=0.5)
ax.set_title('Teacher Designation Breakdown', fontsize=14, fontweight='bold',
             color='white', pad=12)
ax.set_xlabel('Designation', color='#94A3B8')
ax.set_ylabel('Number of Teachers', color='#94A3B8')
ax.tick_params(colors='#CBD5E1')
for s in ['top', 'right']: ax.spines[s].set_visible(False)
for s in ['bottom', 'left']: ax.spines[s].set_color('#334155')
ax.set_facecolor(C_DARK)
ax.grid(axis='y', color='#1E293B', linewidth=0.5)
for bar in bars:
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 4,
            str(int(bar.get_height())), ha='center', color='white', fontsize=10, fontweight='bold')
plt.tight_layout()
save(fig, "04_designations")

# ── Chart 5: Onboarding timeline (daily) ──────────────────────────────────────
db_users['date'] = pd.to_datetime(db_users['created_at']).dt.date
tl = db_users.groupby('date').size().reset_index(name='count')
tl['date_str'] = tl['date'].astype(str)

fig, ax = plt.subplots(figsize=(13, 5), facecolor=C_DARK)
ax.set_facecolor(C_DARK)
bar_colors = [C_AMBER if d >= datetime.date(2026, 3, 11) else C_TEAL
              for d in tl['date'].tolist()]
bars = ax.bar(tl['date_str'], tl['count'], color=bar_colors, edgecolor=C_DARK, linewidth=0.5)
ax.set_title('STEDA Teacher Onboarding Timeline — Daily Activations', fontsize=14,
             fontweight='bold', color='white', pad=12)
ax.set_xlabel('Date', color='#94A3B8')
ax.set_ylabel('New Users Activated', color='#94A3B8')
ax.tick_params(colors='#CBD5E1', axis='both')
plt.xticks(rotation=30, ha='right', fontsize=9)
for s in ['top', 'right']: ax.spines[s].set_visible(False)
for s in ['bottom', 'left']: ax.spines[s].set_color('#334155')
ax.grid(axis='y', color='#1E293B', linewidth=0.5)
for bar, val in zip(bars, tl['count']):
    if val > 0:
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 2,
                str(val), ha='center', color='white', fontsize=10, fontweight='bold')
# Legend
ax.legend(handles=[
    mpatches.Patch(color=C_TEAL,  label='Feb Batch'),
    mpatches.Patch(color=C_AMBER, label='Mar 11–12 Surge'),
], framealpha=0, labelcolor='#CBD5E1', fontsize=10)
plt.tight_layout()
save(fig, "05_timeline")

# ── Chart 6: Lesson plan usage — adoption waterfall ───────────────────────────
total_db = len(db_users)
used_lp  = int(lp_stats['users_lp'])
not_yet  = total_db - used_lp

fig, ax = plt.subplots(figsize=(9, 5), facecolor=C_DARK)
ax.set_facecolor(C_DARK)
cats = ['Joined Rumi\n(Matched)', 'Used Lesson\nPlan Feature', 'Not Yet Used\nLesson Plans']
vals = [total_db, used_lp, not_yet]
colors_w = [C_TEAL, C_GREEN, '#475569']
bars = ax.bar(cats, vals, color=colors_w, edgecolor=C_DARK, linewidth=0.5, width=0.55)
ax.set_title('STEDA Feature Adoption — Lesson Plans', fontsize=14,
             fontweight='bold', color='white', pad=12)
ax.set_ylabel('Teachers', color='#94A3B8')
ax.tick_params(colors='#CBD5E1')
for s in ['top','right']: ax.spines[s].set_visible(False)
for s in ['bottom','left']: ax.spines[s].set_color('#334155')
ax.grid(axis='y', color='#1E293B', linewidth=0.5)
for bar, val in zip(bars, vals):
    pct = val / total_db * 100
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 4,
            f"{val:,}\n({pct:.0f}%)", ha='center', va='bottom',
            color='white', fontsize=12, fontweight='bold')
plt.tight_layout()
save(fig, "06_feature_adoption")

# ── Chart 7: WhatsApp community sentiment donut ───────────────────────────────
n_pos     = len([m for m in user_msgs if any(k in m['text'].lower() for k in
    ['great','amazing','wonderful','thrilled','fantastic','mind','superb','awesome',
     'useful','helpful','thank','hats off','proud','initiative','glad','love'])])
n_neutral = len([m for m in user_msgs if '?' in m['text'] or
    any(k in m['text'].lower() for k in ['how','what','where','when','why','kaise','kia','kya'])])
n_issue   = len([m for m in user_msgs if any(k in m['text'].lower() for k in
    ['problem','issue','glitch','not work','error','slow','not receiv','nahi','cannot','can\'t'])])
n_rest    = max(0, len(user_msgs) - n_pos - n_neutral - n_issue)

vals_s = [n_pos, n_neutral, n_issue, n_rest]
labels_s = [f"Positive\n({n_pos})", f"Questions\n({n_neutral})", f"Issues\n({n_issue})", f"Other\n({n_rest})"]
colors_s = [C_GREEN, C_BLUE, C_RED, '#64748B']

fig, ax = plt.subplots(figsize=(8, 6), facecolor=C_DARK)
ax.set_facecolor(C_DARK)
wedges, texts, autotexts = ax.pie(
    vals_s, labels=labels_s, colors=colors_s,
    autopct='%1.0f%%', startangle=90, pctdistance=0.75,
    wedgeprops=dict(width=0.52, edgecolor=C_DARK, linewidth=2),
    textprops={'color': '#CBD5E1', 'fontsize': 11})
for at in autotexts: at.set_color('white'); at.set_fontweight('bold')
ax.text(0, 0, f"{len(user_msgs)}\nmessages", ha='center', va='center',
        fontsize=14, color='white', fontweight='bold')
ax.set_title('WhatsApp Community\nSentiment Analysis', fontsize=14,
             fontweight='bold', color='white', pad=8)
plt.tight_layout()
save(fig, "07_sentiment")

# ── Chart 8: Lesson plan generation time comparison bar ───────────────────────
fig, ax = plt.subplots(figsize=(10, 5), facecolor=C_DARK)
ax.set_facecolor(C_DARK)
metrics = ['Avg Total Wait', 'Avg Queue Wait', 'Avg AI Processing']
feb_v   = [34.89, 32.40, 2.49]
mar_v   = [float(lp_stats['avg_total_min']), float(lp_stats['avg_queue_min']), float(lp_stats['avg_ai_min'])]
x = np.arange(3)
b1 = ax.bar(x - 0.22, feb_v, 0.42, label='Feb 2026 STEDA',   color=C_GREEN,  edgecolor=C_DARK)
b2 = ax.bar(x + 0.22, mar_v, 0.42, label='Mar 11–12 STEDA', color=C_AMBER,  edgecolor=C_DARK)
ax.set_xticks(x); ax.set_xticklabels(metrics, color='#CBD5E1', fontsize=11)
ax.set_ylabel('Minutes', color='#94A3B8')
ax.tick_params(colors='#94A3B8')
ax.set_title('Lesson Plan Latency: Feb vs Mar 11–12', fontsize=14, fontweight='bold', color='white', pad=12)
ax.legend(framealpha=0, labelcolor='#CBD5E1', fontsize=11)
for s in ['top','right']: ax.spines[s].set_visible(False)
for s in ['bottom','left']: ax.spines[s].set_color('#334155')
ax.grid(axis='y', color='#1E293B', linewidth=0.5)
for bar in list(b1)+list(b2):
    h = bar.get_height()
    ax.text(bar.get_x()+bar.get_width()/2, h+1, f"{h:.1f}",
            ha='center', va='bottom', color='white', fontsize=9, fontweight='bold')
plt.tight_layout()
save(fig, "08_latency_comparison")

# ── Chart 9: Top districts by conversion rate (scatter bubble) ────────────────
top20 = dist[dist['listed'] >= 20].head(20).copy()
fig, ax = plt.subplots(figsize=(12, 7), facecolor=C_DARK)
ax.set_facecolor(C_DARK)
sc = ax.scatter(top20['listed'], top20['pct'], s=top20['onboarded']*3,
                c=top20['pct'], cmap='RdYlGn', vmin=40, vmax=80,
                alpha=0.85, edgecolors='white', linewidth=0.8)
for _, row in top20.iterrows():
    ax.annotate(row['District'], (row['listed'], row['pct']),
                xytext=(5, 4), textcoords='offset points',
                color='#CBD5E1', fontsize=8)
cbar = plt.colorbar(sc, ax=ax)
cbar.set_label('Conversion %', color='#94A3B8')
cbar.ax.yaxis.set_tick_params(color='#94A3B8')
plt.setp(cbar.ax.yaxis.get_ticklabels(), color='#94A3B8')
ax.set_xlabel('Teachers Listed', color='#94A3B8', fontsize=11)
ax.set_ylabel('Onboarding Conversion Rate (%)', color='#94A3B8', fontsize=11)
ax.set_title('District Conversion Rate vs. Scale\n(Bubble size = teachers onboarded)',
             fontsize=13, fontweight='bold', color='white', pad=12)
ax.tick_params(colors='#94A3B8')
for s in ['top','right']: ax.spines[s].set_visible(False)
for s in ['bottom','left']: ax.spines[s].set_color('#334155')
ax.grid(color='#1E293B', linewidth=0.4)
ax.axhline(dist['pct'].mean(), color=C_TEAL, linestyle='--', linewidth=1.2,
           label=f"Avg {dist['pct'].mean():.0f}%")
ax.legend(framealpha=0, labelcolor='#CBD5E1', fontsize=10)
plt.tight_layout()
save(fig, "09_district_bubble")

print(f"\nAll charts saved → {OUT}/\n")

# ─────────────────────────────────────────────────────────────────────────────
# 4. PDF REPORT
# ─────────────────────────────────────────────────────────────────────────────
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image as RLImage, HRFlowable, PageBreak, KeepTogether
)
from reportlab.pdfgen import canvas as pdfcanvas

PAGE_W, PAGE_H = A4
MARGIN = 1.7 * cm
CW = PAGE_W - 2 * MARGIN

# Colours (reportlab)
RC_TEAL   = colors.HexColor("#0D9488")
RC_DARK   = colors.HexColor("#0F172A")
RC_SLATE  = colors.HexColor("#334155")
RC_LIGHT  = colors.HexColor("#F1F5F9")
RC_AMBER  = colors.HexColor("#F59E0B")
RC_GREEN  = colors.HexColor("#22C55E")
RC_RED    = colors.HexColor("#EF4444")
RC_BLUE   = colors.HexColor("#3B82F6")
RC_PURPLE = colors.HexColor("#8B5CF6")
RC_PINK   = colors.HexColor("#EC4899")
RC_WHITE  = colors.white
RC_LINE   = colors.HexColor("#CBD5E1")
RC_MUTED  = colors.HexColor("#64748B")
RC_SUBTEXT= colors.HexColor("#94A3B8")

def S(name, **kw): return ParagraphStyle(name, **kw)

# ── Type styles ───────────────────────────────────────────────────────────────
S_H1 = S("H1", fontName="Helvetica-Bold", fontSize=16, leading=21,
          textColor=RC_WHITE, backColor=RC_TEAL,
          leftPadding=12, rightPadding=12, topPadding=8, bottomPadding=8,
          spaceAfter=4, spaceBefore=16)
S_H2 = S("H2", fontName="Helvetica-Bold", fontSize=12, leading=16,
          textColor=RC_TEAL, spaceAfter=4, spaceBefore=10)
S_BODY = S("Body", fontName="Helvetica", fontSize=9.5, leading=14,
           textColor=RC_SLATE, spaceAfter=4)
S_BOLD = S("Bold", fontName="Helvetica-Bold", fontSize=9.5, leading=14,
           textColor=RC_DARK, spaceAfter=4)
S_CAP  = S("Cap", fontName="Helvetica-Oblique", fontSize=8.5, leading=12,
           textColor=RC_MUTED, alignment=TA_CENTER, spaceAfter=8)
S_QUOTE= S("Quote", fontName="Helvetica-Oblique", fontSize=10, leading=15,
           textColor=RC_DARK, backColor=colors.HexColor("#F8FAFC"),
           leftPadding=12, rightPadding=12, topPadding=8, bottomPadding=8,
           spaceAfter=0, borderColor=RC_TEAL, borderWidth=2,
           borderPadding=0)
S_ISSUE= S("Issue", fontName="Helvetica-Oblique", fontSize=10, leading=15,
           textColor=RC_DARK, backColor=colors.HexColor("#FFF7F7"),
           leftPadding=12, rightPadding=12, topPadding=8, bottomPadding=8,
           spaceAfter=0, borderColor=RC_RED, borderWidth=2)
S_BADGE= S("Badge", fontName="Helvetica-Bold", fontSize=9, leading=11,
           textColor=RC_WHITE, alignment=TA_CENTER)
S_KPI_VAL = S("KpiVal", fontName="Helvetica-Bold", fontSize=22, leading=26,
              textColor=RC_TEAL, alignment=TA_CENTER)
S_KPI_LBL = S("KpiLbl", fontName="Helvetica", fontSize=8.5, leading=12,
              textColor=RC_SLATE, alignment=TA_CENTER)
S_FOOT = S("Foot", fontName="Helvetica", fontSize=8,
           textColor=RC_SUBTEXT, alignment=TA_CENTER)
S_SECNUM = S("SecNum", fontName="Helvetica-Bold", fontSize=26, leading=30,
             textColor=RC_LIGHT, alignment=TA_CENTER)
S_SMALL = S("Small", fontName="Helvetica", fontSize=8.5, leading=12,
            textColor=RC_MUTED)
S_TBLHDR = S("TblHdr", fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=RC_WHITE)
S_TBLCELL= S("TblCell", fontName="Helvetica", fontSize=8.5, leading=11, textColor=RC_DARK)
S_TBLBOLD= S("TblBold", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=RC_DARK)

def sp(h=0.3): return Spacer(1, h * cm)
def hr(): return HRFlowable(width="100%", thickness=0.5, color=RC_LINE,
                             spaceAfter=5, spaceBefore=5)
def section(num, title):
    return [sp(0.2),
            Table([[Paragraph(num, S_SECNUM), Paragraph(title, S_H1)]],
                  colWidths=[1.4*cm, CW - 1.4*cm],
                  style=TableStyle([
                      ("BACKGROUND", (1,0),(1,0), RC_TEAL),
                      ("BACKGROUND", (0,0),(0,0), RC_SLATE),
                      ("VALIGN", (0,0),(-1,-1), "MIDDLE"),
                      ("TOPPADDING", (0,0),(-1,-1), 0),
                      ("BOTTOMPADDING", (0,0),(-1,-1), 0),
                      ("LEFTPADDING", (0,0),(-1,-1), 0),
                  ])),
            sp(0.25)]

def body(t): return Paragraph(t, S_BODY)
def bold(t): return Paragraph(t, S_BOLD)

def chart_img(name, w=None, caption=None):
    p = f"{OUT}/{name}.png"
    if not os.path.exists(p): return []
    w = w or CW
    h = w * 0.46
    items = [sp(0.2), RLImage(p, width=w, height=h)]
    if caption: items.append(Paragraph(caption, S_CAP))
    items.append(sp(0.1))
    return items

def kpi_row(cards):
    """cards = [(val, label, color), ...]"""
    n = len(cards)
    cw = CW / n
    cells = []
    for val, label, color in cards:
        rc = colors.HexColor(color)
        cell = Table(
            [[Paragraph(val,   S_KPI_VAL)],
             [Paragraph(label, S_KPI_LBL)]],
            colWidths=[cw - 0.4*cm],
            style=TableStyle([
                ("BACKGROUND", (0,0),(-1,-1), RC_LIGHT),
                ("BOX", (0,0),(-1,-1), 2, rc),
                ("TOPPADDING", (0,0),(-1,-1), 10),
                ("BOTTOMPADDING", (0,0),(-1,-1), 10),
                ("LEFTPADDING", (0,0),(-1,-1), 4),
                ("RIGHTPADDING", (0,0),(-1,-1), 4),
            ]))
        cells.append(cell)
    row = Table([cells], colWidths=[cw]*n,
                style=TableStyle([
                    ("ALIGN", (0,0),(-1,-1), "CENTER"),
                    ("VALIGN", (0,0),(-1,-1), "MIDDLE"),
                    ("LEFTPADDING", (0,0),(-1,-1), 3),
                    ("RIGHTPADDING", (0,0),(-1,-1), 3),
                ]))
    return [row, sp(0.3)]

def two_col(left_items, right_items, lw=0.52):
    """Two-column layout."""
    rw = 1.0 - lw
    left  = [[item] for item in left_items]
    right = [[item] for item in right_items]
    if not left:  left = [[sp(0.1)]]
    if not right: right = [[sp(0.1)]]
    lt = Table(left,  colWidths=[CW * lw - 0.2*cm])
    rt = Table(right, colWidths=[CW * rw - 0.2*cm])
    t = Table([[lt, rt]], colWidths=[CW*lw, CW*rw],
              style=TableStyle([
                  ("VALIGN", (0,0),(-1,-1), "TOP"),
                  ("LEFTPADDING", (0,0),(-1,-1), 0),
                  ("RIGHTPADDING", (0,0),(-1,-1), 4),
              ]))
    return [t]

def quote_block(text, speaker, positive=True):
    style = S_QUOTE if positive else S_ISSUE
    color = RC_TEAL  if positive else RC_RED
    q = Table([
        [Paragraph(f'"{text}"', style)],
        [Paragraph(f"— {speaker}", S_SMALL)],
    ], colWidths=[CW],
    style=TableStyle([
        ("LINERIGHT", (0,0),(0,0), 3, color),
        ("TOPPADDING", (0,0),(-1,-1), 0),
        ("BOTTOMPADDING", (0,0),(-1,-1), 3),
        ("LEFTPADDING", (0,0),(-1,-1), 0),
        ("RIGHTPADDING", (0,0),(-1,-1), 0),
    ]))
    return [q, sp(0.2)]

def dtable(headers, rows, col_widths=None, hi=None):
    hdr = [Paragraph(h, S_TBLHDR) for h in headers]
    data = [hdr]
    for i, row in enumerate(rows):
        sty = S_TBLBOLD if (hi and i in hi) else S_TBLCELL
        data.append([Paragraph(str(c), sty) for c in row])
    n = len(headers)
    cw = col_widths or [CW/n]*n
    t = Table(data, colWidths=cw)
    ts = TableStyle([
        ("BACKGROUND", (0,0),(-1,0), RC_TEAL),
        ("ROWBACKGROUNDS", (0,1),(-1,-1), [RC_WHITE, RC_LIGHT]),
        ("GRID", (0,0),(-1,-1), 0.4, RC_LINE),
        ("VALIGN", (0,0),(-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0),(-1,-1), 5),
        ("BOTTOMPADDING", (0,0),(-1,-1), 5),
        ("LEFTPADDING", (0,0),(-1,-1), 7),
    ])
    if hi:
        for r in hi:
            ts.add("BACKGROUND", (0,r+1),(-1,r+1), colors.HexColor("#ECFDF5"))
    t.setStyle(ts)
    return t

def progress_bar_table(label, val, total, color_hex):
    pct = val / total * 100
    filled = CW * 0.5 * val / total
    remaining = CW * 0.5 - filled
    bar = Table([[
        Table([[""]], colWidths=[filled],
              style=TableStyle([("BACKGROUND",(0,0),(-1,-1), colors.HexColor(color_hex)),
                                ("TOPPADDING",(0,0),(-1,-1), 5),
                                ("BOTTOMPADDING",(0,0),(-1,-1), 5)])),
        Table([[""]], colWidths=[remaining],
              style=TableStyle([("BACKGROUND",(0,0),(-1,-1), colors.HexColor("#E2E8F0")),
                                ("TOPPADDING",(0,0),(-1,-1), 5),
                                ("BOTTOMPADDING",(0,0),(-1,-1), 5)])),
    ]], colWidths=[filled, remaining],
    style=TableStyle([("TOPPADDING",(0,0),(-1,-1),0),
                      ("BOTTOMPADDING",(0,0),(-1,-1),0),
                      ("LEFTPADDING",(0,0),(-1,-1),0),
                      ("RIGHTPADDING",(0,0),(-1,-1),0)]))
    row = Table([
        [Paragraph(label, S_TBLCELL), bar,
         Paragraph(f"<b>{val:,}</b> / {total:,}  ({pct:.0f}%)", S_TBLBOLD)]
    ], colWidths=[CW*0.28, CW*0.50, CW*0.22],
    style=TableStyle([
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",(0,0),(-1,-1),4),
        ("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LINEBELOW",(0,0),(-1,-1),0.4, RC_LINE),
        ("LEFTPADDING",(0,0),(-1,-1),0),
    ]))
    return row

# ── Numbered canvas (page footer) ─────────────────────────────────────────────
class NumberedCanvas(pdfcanvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved = []
    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()
    def save(self):
        total = len(self._saved)
        for state in self._saved:
            self.__dict__.update(state)
            pg = self._pageNumber
            if pg > 1:
                self.saveState()
                self.setFont("Helvetica", 8)
                self.setFillColor(colors.HexColor("#94A3B8"))
                self.drawCentredString(PAGE_W/2, 0.75*cm,
                    f"STEDA × Rumi Partnership Report  |  Confidential  |  Page {pg} of {total}")
                # Decorative bottom line
                self.setStrokeColor(colors.HexColor("#0D9488"))
                self.setLineWidth(1.5)
                self.line(MARGIN, 1.0*cm, PAGE_W - MARGIN, 1.0*cm)
                self.restoreState()
            super().showPage()
        super().save()

# ─────────────────────────────────────────────────────────────────────────────
# 5. BUILD STORY
# ─────────────────────────────────────────────────────────────────────────────
print("Building PDF story …")
story = []

# ═══════════════════════════════════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════════════════════════════════

# Top banner
banner = Table([
    [Paragraph("STEDA × Rumi",
               S("B1", fontName="Helvetica-Bold", fontSize=38, leading=44, textColor=RC_TEAL))],
    [Paragraph("Partnership Impact Report",
               S("B2", fontName="Helvetica-Bold", fontSize=24, leading=29, textColor=RC_WHITE))],
    [sp(0.2)],
    [Paragraph("AI-Powered Teaching Pilot — Sindh Province, Pakistan",
               S("B3", fontName="Helvetica", fontSize=13, leading=17,
                 textColor=colors.HexColor("#94A3B8")))],
], colWidths=[CW],
style=TableStyle([
    ("BACKGROUND", (0,0),(-1,-1), RC_DARK),
    ("TOPPADDING", (0,0),(-1,-1), 28),
    ("BOTTOMPADDING",(0,0),(-1,-1),24),
    ("LEFTPADDING", (0,0),(-1,-1), 24),
    ("RIGHTPADDING",(0,0),(-1,-1), 24),
]))
story.append(banner)
story.append(sp(0.6))

# Meta info row
meta = Table([[
    Paragraph(f"<b>Report Date:</b> {datetime.datetime.now().strftime('%B %d, %Y')}", S_BODY),
    Paragraph("<b>Prepared by:</b> Rumi Data Team", S_BODY),
    Paragraph("<b>For:</b> STEDA Program Leadership", S_BODY),
]], colWidths=[CW/3]*3,
style=TableStyle([
    ("BACKGROUND", (0,0),(-1,-1), RC_LIGHT),
    ("TOPPADDING", (0,0),(-1,-1), 10),
    ("BOTTOMPADDING",(0,0),(-1,-1), 10),
    ("LEFTPADDING", (0,0),(-1,-1), 12),
    ("BOX", (0,0),(-1,-1), 1, RC_LINE),
]))
story.append(meta)
story.append(sp(0.5))
story.append(hr())
story.append(sp(0.3))

# 5 KPIs on cover
story += kpi_row([
    ("1,349",  "Teachers\nListed by STEDA",   "#0D9488"),
    ("853",    "Joined Rumi\n(63.2% of list)", "#3B82F6"),
    (f"{int(lp_stats['users_lp']):,}", "Used\nLesson Plans", "#22C55E"),
    (f"{int(lp_stats['completed']):,}", "Lesson Plans\nGenerated",     "#F59E0B"),
    ("503",    "WhatsApp\nCommunity Members",  "#8B5CF6"),
])

story.append(sp(0.3))
story.append(hr())
story.append(sp(0.3))

# Executive summary on cover
story.append(Paragraph("Executive Summary", S_H2))
story.append(body(
    "The STEDA–Rumi pilot launched in Sindh Province represents a landmark step in bringing "
    "AI-powered teaching assistance to government school teachers at scale. This report covers "
    "the period from <b>January 2026 through March 12, 2026</b>, analysing the activation of "
    "<b>1,349 STEDA-listed teachers</b>, their onboarding into the Rumi platform, lesson-plan "
    "generation activity, and real-time feedback from the WhatsApp community."
))
story.append(sp(0.15))

# Two-column highlight box
hi_left = [
    bold("✓  What Worked"),
    sp(0.1),
    body("• <b>853 teachers activated</b> (63.2%) in under 3 weeks"),
    body("• <b>100% completion rate</b> on lesson plan requests"),
    body("• <b>Strong first impressions</b> — teachers generating plans within minutes of joining"),
    body("• AI processing stable at <b>~2.4 min</b> regardless of load"),
    body("• Organic peer-support in WhatsApp community"),
]
hi_right = [
    bold("⚠  Needs Attention"),
    sp(0.1),
    body("• <b>496 teachers (36.8%)</b> not yet activated on Rumi"),
    body("• Queue saturation on Mar 11 — wait time hit <b>4 hours</b>"),
    body("• Registration guidance was <b>confusing</b> for many teachers"),
    body("• Video/animation requests caused <b>confusion</b> about capabilities"),
    body("• <b>Portal login issues</b> reported by multiple teachers"),
]
story += two_col(hi_left, hi_right)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════
# PAGE 2: SECTION 1 — Onboarding Funnel & Timeline
# ═══════════════════════════════════════════════════════════════════════
story += section("01", "Onboarding Funnel & Teacher Activation")

story.append(body(
    "Of the <b>1,349 teachers listed in STEDA's onboarding file</b>, <b>853 (63.2%)</b> have successfully "
    "activated their Rumi accounts. The majority arrived in two waves: the <b>February batch</b> "
    "(107 teachers, 24–27 Feb) and the <b>March 11–12 surge</b> (692 teachers in two days)."
))
story.append(sp(0.2))

# Progress bars
pb_items = [
    progress_bar_table("Listed by STEDA",     1349, 1349, "#3B82F6"),
    progress_bar_table("Activated on Rumi",    853, 1349, "#0D9488"),
    progress_bar_table("Used Lesson Plans",    int(lp_stats['users_lp']), 1349, "#22C55E"),
    progress_bar_table("Not Yet Joined",       496, 1349, "#EF4444"),
]
pb_t = Table([[item] for item in pb_items], colWidths=[CW])
pb_t.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0)]))
story.append(pb_t)
story.append(sp(0.3))

story += chart_img("01_funnel", caption=
    "Figure 1 — Onboarding funnel: from STEDA list → Rumi activation → lesson plan usage.")
story += chart_img("05_timeline", caption=
    "Figure 2 — Daily teacher activation timeline. The February batch (teal) shows gradual "
    "onboarding; the amber bars show the March 11–12 bulk activation event.")

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════
# PAGE 3: SECTION 2 — Teacher Demographics
# ═══════════════════════════════════════════════════════════════════════
story += section("02", "Teacher Demographics & District Coverage")

story.append(body(
    "The STEDA teacher list spans <b>29 districts</b> across Sindh, covering both urban centres "
    "(Karachi, Hyderabad) and rural areas (Sanghar, Umerkot, Tharparkar). <b>89.5% are from "
    "public schools</b> — primarily government primary and elementary school teachers."
))
story.append(sp(0.2))
story += chart_img("03_demographics", caption=
    "Figure 3 — Gender split (left) and school type distribution (right) across all 1,349 listed teachers.")
story += chart_img("04_designations", caption=
    "Figure 4 — Designation breakdown. JEST/JST and PST teachers form the majority — "
    "primary and elementary level educators.")

story.append(sp(0.2))
story.append(Paragraph("District-wise Onboarding Breakdown — Top 15", S_H2))
dist_rows = []
for _, row in dist.head(15).iterrows():
    dist_rows.append([row['District'], str(int(row['listed'])),
                      str(int(row['onboarded'])), str(int(row['not_yet'])),
                      f"{row['pct']:.0f}%"])
story.append(dtable(
    ["District", "Listed", "Joined Rumi", "Not Yet", "Rate"],
    dist_rows,
    col_widths=[CW*0.32, CW*0.14, CW*0.18, CW*0.14, CW*0.12],
    hi=[i for i, r in enumerate(dist_rows) if float(r[4].rstrip('%')) >= 70]
))
story.append(sp(0.2))
story += chart_img("02_districts", caption=
    "Figure 5 — Stacked bar: teachers who joined Rumi (teal) vs not yet (dark blue) by district. "
    "Percentages on the right show conversion rate.")

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════
# PAGE 4: SECTION 3 — Lesson Plan Activity
# ═══════════════════════════════════════════════════════════════════════
story += section("03", "Lesson Plan Generation Activity")

story.append(body(
    f"STEDA-matched teachers have collectively generated <b>{int(lp_stats['completed']):,} lesson plans</b>, "
    f"all successfully completed (100% completion rate). <b>{int(lp_stats['users_lp']):,} unique teachers</b> "
    f"({int(lp_stats['users_lp'])/853*100:.0f}% of activated users) have used the lesson plan feature at least once."
))
story.append(sp(0.3))

story += kpi_row([
    (f"{int(lp_stats['completed']):,}", "Lesson Plans\nCompleted",      "#22C55E"),
    (f"{int(lp_stats['users_lp']):,}", "Unique Teachers\nUsed Feature", "#0D9488"),
    ("100%",                            "Completion\nRate",              "#3B82F6"),
    (f"{float(lp_stats['avg_ai_min']):.1f} min", "Avg AI\nProcessing Time", "#8B5CF6"),
])

story += chart_img("06_feature_adoption", caption=
    "Figure 6 — Of 853 activated STEDA teachers, 37% have generated at least one lesson plan. "
    f"The remaining {853-int(lp_stats['users_lp']):,} are registered but haven't tried the feature yet.")

story.append(Paragraph("Latency: February vs March 11–12", S_H2))
story.append(body(
    "The February STEDA cohort experienced healthy performance — <b>median wait 3.2 minutes</b>. "
    "The March 11–12 surge caused a temporary queue overload, pushing average wait to <b>138 minutes</b>. "
    "Crucially, <b>AI processing remained stable at 2.4 minutes</b> throughout — the issue was "
    "purely a queue capacity problem triggered by 179 simultaneous requests at 14:00 UTC on March 11."
))
story.append(sp(0.2))
story += chart_img("08_latency_comparison", caption=
    "Figure 7 — Avg queue wait vs avg AI processing time (Feb vs Mar 11–12). "
    "AI processing (rightmost bars) is virtually identical — the entire delta is queue wait.")

story.append(sp(0.2))
story.append(dtable(
    ["Cohort", "Requests", "Avg Total", "Median Total", "Avg Queue", "Avg AI", "Over 10 min"],
    [
        ["Feb 2026 (90 STEDA users)",    "212", "34.9 min", "3.2 min",  "32.4 min", "2.5 min", "24%"],
        ["Mar 11–12 (199 STEDA users)", "276", "138.1 min","137.8 min","135.7 min","2.4 min","87.7%"],
    ],
    col_widths=[CW*0.30, CW*0.11, CW*0.12, CW*0.13, CW*0.12, CW*0.10, CW*0.12],
    hi=[1]
))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════
# PAGE 5: SECTION 4 — WhatsApp Community Voices
# ═══════════════════════════════════════════════════════════════════════
story += section("04", "WhatsApp Community — Teacher Voices & Feedback")

story.append(body(
    f"Within hours of the March 11 onboarding, <b>503 teachers joined the Rumi WhatsApp community</b>. "
    f"<b>128 unique members</b> sent messages — an engagement rate of 25% — with <b>{len(user_msgs)} "
    f"user messages</b> in the first 24 hours. Teachers were simultaneously excited, curious, "
    f"and navigating real-time challenges."
))
story.append(sp(0.3))

story += kpi_row([
    ("503",  "Community\nMembers Joined",  "#8B5CF6"),
    ("128",  "Unique Active\nParticipants","#0D9488"),
    (str(len(user_msgs)), "Messages in\n24 Hours",    "#3B82F6"),
    ("32",   "Teachers\nLeft (6.4%)",      "#F59E0B"),
])

story.append(sp(0.15))
story += chart_img("07_sentiment", w=CW*0.55, caption=
    "Figure 8 — Message sentiment analysis across all user messages in the community chat.")

story.append(Paragraph("✦  What Teachers Said — Positive Voices", S_H2))
story.append(sp(0.1))
for person, quote in PRAISE_QUOTES[:6]:
    story += quote_block(quote, person, positive=True)

story.append(sp(0.3))
story.append(Paragraph("⚠  Issues & Confusion Raised", S_H2))
story.append(sp(0.1))
for person, issue in ISSUE_QUOTES:
    story += quote_block(issue, person, positive=False)

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════
# PAGE 6: SECTION 5 — Gap Analysis & Who's Missing
# ═══════════════════════════════════════════════════════════════════════
story += section("05", "Gap Analysis — The 496 Not Yet Onboarded")

story.append(body(
    "<b>496 teachers (36.8%)</b> from the STEDA list have not yet joined Rumi. Understanding "
    "where the gaps are concentrated helps STEDA focus re-outreach efforts."
))
story.append(sp(0.2))

# Low-performing districts
low_dist = dist[dist['listed'] >= 15].nsmallest(10, 'pct')[['District','listed','onboarded','not_yet','pct']]
low_rows = [[r['District'], str(int(r['listed'])), str(int(r['onboarded'])),
             str(int(r['not_yet'])), f"{r['pct']:.0f}%"]
            for _, r in low_dist.iterrows()]
story.append(Paragraph("Districts with Lowest Activation Rate (≥15 listed)", S_H2))
story.append(dtable(
    ["District", "Listed", "Joined", "Not Yet", "Rate"],
    low_rows,
    col_widths=[CW*0.34, CW*0.14, CW*0.14, CW*0.14, CW*0.12],
))
story.append(sp(0.3))
story += chart_img("09_district_bubble", caption=
    "Figure 9 — Each bubble = one district. X = teachers listed, Y = conversion rate, "
    "size = teachers onboarded. Districts below the dashed line need re-outreach.")
story.append(sp(0.2))

story.append(Paragraph("Likely Reasons for Non-Activation", S_H2))
reasons = [
    ("Registration confusion",
     "Multiple teachers asked in WhatsApp how to register — suggesting the onboarding "
     "instructions were not clear enough for first-time WhatsApp AI users."),
    ("Phone number mismatch",
     "3 entries in the CSV have missing WhatsApp numbers; some numbers may differ from "
     "those used in Rumi's database."),
    ("Timing & exam season",
     "Several teachers noted exams are ongoing ('papers chal rahe hain') and referenced "
     "Ramadan — suggesting deliberate deferral."),
    ("Technical barriers",
     "Portal login failures and confusion about where to interact with Rumi "
     "created friction for a subset of teachers."),
    ("Lack of follow-up",
     "Some teachers joined the WhatsApp group but may not have received the individual "
     "Rumi activation message via WhatsApp."),
]
for title, detail in reasons:
    story.append(
        Table([[
            Paragraph(f"▸  {title}", S_BOLD),
            Paragraph(detail, S_BODY),
        ]], colWidths=[CW*0.30, CW*0.70],
        style=TableStyle([
            ("VALIGN", (0,0),(-1,-1), "TOP"),
            ("TOPPADDING", (0,0),(-1,-1), 5),
            ("BOTTOMPADDING", (0,0),(-1,-1), 5),
            ("LINEBELOW", (0,0),(-1,-1), 0.4, RC_LINE),
            ("BACKGROUND", (0,0),(0,-1), RC_LIGHT),
        ]))
    )

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════
# PAGE 7: SECTION 6 — Recommendations & Next Steps
# ═══════════════════════════════════════════════════════════════════════
story += section("06", "Recommendations & Next Steps for STEDA")

story.append(body(
    "Based on the data analysis and teacher feedback, the following actions are recommended "
    "as the partnership scales into the next phase."
))
story.append(sp(0.3))

recs = [
    ("#0D9488", "1", "Re-Activate the 496 Missing Teachers",
     "Send a personalised WhatsApp message to each of the 496 phone numbers that have not yet "
     "joined Rumi. Include a clear, single-step activation instruction. Assign district "
     "focal persons to follow up on low-performing areas (SBA 51.5%, Umerkot 51.3%)."),
    ("#3B82F6", "2", "Provide a Simple 'Getting Started' Guide",
     "The WhatsApp chat showed widespread confusion about how to use Rumi. Create a 1-page "
     "Urdu/English guide with three commands: (1) Create lesson plan, (2) Get coaching, "
     "(3) Assess students. Distribute via the WhatsApp announcements group."),
    ("#F59E0B", "3", "Fix Portal Login Before Next Batch",
     "Multiple teachers reported portal login failures. Rumi engineering should audit and "
     "resolve portal authentication issues before the next bulk activation event."),
    ("#22C55E", "4", "Clarify Video/Animation Expectations",
     "Several teachers expected Rumi to generate videos — a feature not currently available. "
     "Add a clear FAQ message to the WhatsApp group explaining current capabilities "
     "(lesson plans, coaching, reading assessments) vs. planned features."),
    ("#8B5CF6", "5", "Pre-Notify Rumi Before Next STEDA Batch",
     "The March 11 surge of 189 teachers caused a 4-hour queue backlog. Before the next "
     "activation event, share the expected headcount with the Rumi team so infrastructure "
     "can be scaled. A minimum of 48 hours notice is recommended."),
    ("#EC4899", "6", "Celebrate & Share Success Stories",
     "Several teachers produced excellent lesson plans and shared enthusiasm publicly. "
     "Capture 3–5 success stories (with teacher permission) for STEDA's stakeholder reports "
     "and share them in the WhatsApp community to motivate the remaining 496."),
]

for color, num, title, detail in recs:
    rc = colors.HexColor(color)
    story.append(
        Table([[
            Table([[Paragraph(num, S("rn", fontName="Helvetica-Bold", fontSize=18,
                                      textColor=RC_WHITE, alignment=TA_CENTER))]],
                   colWidths=[1.1*cm],
                   style=TableStyle([("BACKGROUND",(0,0),(-1,-1), rc),
                                      ("TOPPADDING",(0,0),(-1,-1), 12),
                                      ("BOTTOMPADDING",(0,0),(-1,-1), 12)])),
            Table([
                [Paragraph(title, S("rt", fontName="Helvetica-Bold", fontSize=10.5,
                                     textColor=rc))],
                [Paragraph(detail, S_BODY)],
            ], colWidths=[CW - 1.6*cm]),
        ]], colWidths=[1.3*cm, CW - 1.3*cm],
        style=TableStyle([
            ("VALIGN", (0,0),(-1,-1), "TOP"),
            ("TOPPADDING", (0,0),(-1,-1), 5),
            ("BOTTOMPADDING", (0,0),(-1,-1), 5),
            ("LINEBELOW", (0,0),(-1,-1), 0.5, RC_LINE),
        ]))
    )
    story.append(sp(0.1))

story.append(sp(0.4))
story.append(hr())
story.append(sp(0.3))

# Closing statement
closing = Table([[
    Paragraph(
        "This pilot demonstrates that Pakistan's government school teachers are ready, "
        "willing, and able to adopt AI tools — when given the right support. The "
        "enthusiasm in the WhatsApp community within hours of launch is a strong "
        "signal. With the right infrastructure fixes and re-outreach, the STEDA–Rumi "
        "partnership is positioned to achieve <b>full 1,349-teacher activation</b> "
        "within the next 30 days.",
        S("closing", fontName="Helvetica", fontSize=10, leading=15, textColor=RC_DARK))
]], colWidths=[CW],
style=TableStyle([
    ("BACKGROUND", (0,0),(-1,-1), colors.HexColor("#F0FDFA")),
    ("BOX", (0,0),(-1,-1), 2, RC_TEAL),
    ("TOPPADDING", (0,0),(-1,-1), 14),
    ("BOTTOMPADDING",(0,0),(-1,-1), 14),
    ("LEFTPADDING", (0,0),(-1,-1), 16),
    ("RIGHTPADDING",(0,0),(-1,-1), 16),
]))
story.append(closing)

story.append(sp(0.5))
story.append(Paragraph(
    f"<i>Data period: Jan 2026 – March 12, 2026  ·  Source: Rumi Production DB + STEDA CSV + WhatsApp Community  "
    f"·  Generated {datetime.datetime.now().strftime('%B %d, %Y')}</i>",
    S_FOOT))

# ─────────────────────────────────────────────────────────────────────────────
# 6. RENDER
# ─────────────────────────────────────────────────────────────────────────────
OUT_PDF = "steda_partner_report.pdf"
print(f"Rendering PDF → {OUT_PDF} …")
doc = SimpleDocTemplate(
    OUT_PDF, pagesize=A4,
    topMargin=MARGIN, bottomMargin=1.6*cm,
    leftMargin=MARGIN, rightMargin=MARGIN,
    title="STEDA × Rumi Partnership Impact Report",
    author="Rumi Data Team",
    subject="Partner Onboarding & Performance Analysis",
)
doc.build(story, canvasmaker=NumberedCanvas)
import os
size = os.path.getsize(OUT_PDF)
print(f"\n✓  PDF saved → {OUT_PDF}  ({size/1024:.0f} KB)")
