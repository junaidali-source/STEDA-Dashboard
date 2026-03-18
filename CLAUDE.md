# Rumi Data Analysis — Project Guide

## Repository Layout

```
Rumi Data analysis new/
├── rumi-dashboard/          # Next.js 14 dashboard (main app)
├── whatsapp-service/        # Standalone Node.js WhatsApp listener
├── WhatsApp Chat with General  Discussions.txt   # WhatsApp export (fallback data)
├── wa-messages.json         # Live messages written by whatsapp-service (auto-created)
├── wa-status.json           # whatsapp-service heartbeat (auto-created)
└── STEDA List of Teachers-1 .csv   # STEDA teacher phone/demographic data
```

---

## Dashboard (`rumi-dashboard/`)

**Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Recharts 3 · PostgreSQL (Supabase)

### Running locally
```bash
cd rumi-dashboard
npm run dev        # http://localhost:3000
```

### Build
```bash
npm run build      # typescript: { ignoreBuildErrors: true } is set — Recharts v3 formatter types are pre-existing
```

### Environment variables (`.env.local`)
```
DB_HOST=aws-1-ap-southeast-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=analyst.jlpenspfdcwxkopaidys
DB_PASSWORD=...
```

### Pages
| Route | Description |
|---|---|
| `/` | Overview dashboard (all partners, filterable) |
| `/report` | Cohort report |
| `/steda` | STEDA partner dashboard (partner-facing, no internal metrics) |

---

## STEDA Dashboard

Partner-facing — **never expose** internal infrastructure metrics (avg_queue, avg_ai, processing_started_at, median_total, latency details).

### API routes (`/api/steda/`)
| Route | What it returns |
|---|---|
| `overview` | KPIs for all 5 features: LP, Coaching, Reading, Video, Image |
| `districts` | Per-district teacher breakdown |
| `demographics` | Gender, school type, designations |
| `timeline` | Daily activation counts |
| `feature-adoption` | Per-feature adoption % |
| `engagement-depth` | Cross-feature usage (how many features per teacher) |
| `feature-trends` | Daily usage per feature (no latency) |
| `top-schools` | Top 20 schools by features_active |
| `sentiment` | WhatsApp community sentiment (live + file fallback) |

### Key lib files
- `src/lib/db.ts` — shared `pool`, `userWhere()`, `dateWhere()`, `filterParams()` helpers
- `src/lib/steda-phones.ts` — reads STEDA CSV, normalises phones to `92XXXXXXXXXX`
- `src/lib/whatsapp-parser.ts` — merges `.txt` export + `wa-messages.json`, 30s/5min TTL cache

### STEDA phone matching
Phones normalised: strip spaces/dashes → if starts with `0` replace with `92` → if 10 digits prefix `92`. Matches the Python `norm_phone()` logic exactly.

---

## WhatsApp Live Service (`whatsapp-service/`)

Unofficial `whatsapp-web.js` integration — no third-party API, no cost. Uses WhatsApp Web protocol via Puppeteer.

### Setup (first time)
```bash
cd whatsapp-service
npm install
npm start
# Scan the QR code printed in the terminal with your WhatsApp
# (Settings → Linked Devices → Link a Device)
```

### Subsequent runs
Session is persisted in `.wwebjs_auth/` — reconnects automatically, no QR needed.

### What it does
- Listens to the group matching `"general  discussions"` (override with `WA_GROUP_NAME` env var)
- Excludes admins: Sajid Hussain Mallah, Junaid Ali, You, Afzal ahmed, GUL HASSAN, Ayaz Iqbal Jokhio
- Classifies sentiment with the same keywords as the parser (positive/issue/question/other)
- Writes to `../wa-messages.json` (rolling 2000 message window, deduplicated by ID)
- Writes heartbeat to `../wa-status.json` — dashboard reads this to show connected/disconnected badge

### Dashboard behaviour
- **Service running:** green "Live stream · connected" badge, sentiment panel polls every 30s
- **Service off:** amber "File mode" badge, falls back to `.txt` export, 5min cache

---

## Database Schema (relevant tables)

```sql
users                    -- teacher accounts, phone_number (92XXXXXXXXXX format)
lesson_plan_requests     -- LP feature usage
coaching_sessions        -- Coaching feature usage
reading_assessments      -- Reading feature usage
video_requests           -- Video generation feature usage
image_analysis_requests  -- Image analysis feature usage
conversations            -- chat sessions
dashboard_users          -- partner login accounts
access_scopes            -- partner → phone_number list mapping (scope_type='phone_list')
```

### Filter helpers (`db.ts`)
`userWhere(alias)` always uses params `$1–$4`: country, school, `%school%`, partnerId.
`dateWhere(alias)` uses `$5` (from) and `$6` (to).

---

## Conventions

- **Partner-facing routes** must not expose latency, queue times, or AI processing details
- **Inline styles** are used for runtime data-driven colors (chart segment colors) — linter warnings on these are expected and unavoidable
- **TypeScript build errors** are suppressed (`ignoreBuildErrors: true`) due to a pre-existing Recharts v3 formatter type mismatch in `CohortPanel.tsx`
- **STEDA CSV path** has a trailing space in the filename: `STEDA List of Teachers-1 .csv` — this is intentional, it's the actual filename
- **WhatsApp export path** has two spaces: `WhatsApp Chat with General  Discussions.txt`
