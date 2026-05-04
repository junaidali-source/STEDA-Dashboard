# Rumi Data Analysis — Project Guide

## Layout

```text
Rumi Data analysis new/
├── rumi-dashboard/          # Next.js 14 dashboard (Vercel) — rootDirectory set in Vercel
├── whatsapp-service/        # Node.js WhatsApp listener (run locally)
├── pdf-report/              # PDF generation
├── data/                    # STEDA CSV + WhatsApp .txt exports
├── reports/steda/           # Generated PDFs
├── scripts/steda/ sindh/    # Analysis scripts
├── charts/steda/            # Chart outputs
├── wa-messages.json         # Auto-written by whatsapp-service (do not move)
└── wa-status.json           # whatsapp-service heartbeat file (do not move)
```

## Stack

Next.js 14 · TypeScript · Tailwind · Recharts 3 · PostgreSQL (Supabase) · `@supabase/supabase-js`

## Running

```bash
cd rumi-dashboard && npm run dev        # http://localhost:3000
cd whatsapp-service && npm start        # scan QR once; session cached in .wwebjs_auth/
```

## Auth

Cookie-based HMAC sessions. Roles: `admin` (all tabs) · `steda` (STEDA Report only).
Credentials in `src/lib/auth.ts`. Login at `/login`.

## Routes

| Route | Access |
| --- | --- |
| `/` | admin only |
| `/report` | admin only |
| `/steda` | admin + steda |

## STEDA Dashboard

Partner-facing — **never expose** `avg_queue`, `avg_ai`, `processing_started_at`, latency.

- Date range filter + 5-min auto-refresh in `StedaDashboard.tsx`
- Supabase Realtime pushes new WhatsApp messages to all browsers instantly
- `/api/steda/` routes: `overview` `districts` `demographics` `timeline` `feature-adoption` `engagement-depth` `feature-trends` `top-schools` `sentiment`
- All routes accept `?from=YYYY-MM-DD&to=YYYY-MM-DD`

## WhatsApp Service

Listens to `WA_GROUP_NAME` env (default: `rumi onboarding / feedback`). Excludes admins: Sajid Hussain Mallah, Junaid Ali, You, Afzal ahmed, GUL HASSAN, Ayaz Iqbal Jokhio.

- Writes to Supabase `whatsapp_messages` + local `wa-messages.json`
- Upserts `wa_heartbeat` row every 60s → dashboard reads this for "Live stream" badge
- Dashboard shows green badge if heartbeat `updated_at` < 2 min ago

## Key Files

| File | Purpose |
| --- | --- |
| `src/lib/auth.ts` | HMAC session tokens, credentials |
| `src/lib/db.ts` | pg Pool (port **6543** transaction mode, max 2), `userWhere` `dateWhere` helpers |
| `src/lib/supabase.ts` | Server-side Supabase client |
| `src/lib/supabase-browser.ts` | Browser Supabase client (NEXT_PUBLIC_ vars) |
| `src/lib/steda-phones.ts` | Reads CSV from `rumi-dashboard/data/` |
| `src/lib/whatsapp-parser.ts` | Merges Supabase + .txt; checks heartbeat for liveConnected |
| `src/middleware.ts` | Route protection + role redirect |

## Database

```text
users · lesson_plan_requests · coaching_sessions · reading_assessments
video_requests · image_analysis_requests · conversations
dashboard_users · access_scopes (scope_type='phone_list')
whatsapp_messages · wa_heartbeat        ← Supabase: ordhnhcuwfhxgkmojiml
```

`userWhere(alias)` → `$1–$4` · `dateWhere(alias)` → `$5–$6`

## Env Vars

`.env.local`: `DB_HOST` `DB_PORT=6543` `DB_NAME` `DB_USER` `DB_PASSWORD` `SUPABASE_URL` `SUPABASE_ANON_KEY` `NEXT_PUBLIC_SUPABASE_URL` `NEXT_PUBLIC_SUPABASE_ANON_KEY` `AUTH_SECRET`

## Conventions

- `outputFileTracingIncludes` bundles `rumi-dashboard/data/` into Vercel serverless functions
- `ignoreBuildErrors: true` — Recharts v3 type mismatch in `CohortPanel.tsx`
- CSV filename has trailing space: `STEDA List of Teachers-1 .csv`
- WhatsApp export has two spaces: `WhatsApp Chat with General  Discussions.txt`
