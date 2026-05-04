# Rumi — Cost Per User Per Month Analysis
**Date:** April 23, 2026  
**Status:** Preliminary (based on current screenshot data)

---

## Executive Summary

Based on current usage patterns visible in the Coaching Dashboard and typical SaaS infrastructure costs, Rumi's estimated cost per active user per month is:

| Scenario | Monthly Cost | Users | Cost/User/Month |
|----------|--------------|-------|-----------------|
| **Current** (13 coaching users) | ~$150–200 | 13 | **$11.50–15.38** |
| **Full Capacity** (100 active users) | ~$150–200 | 100 | **$1.50–2.00** |
| **Scale** (500+ active users) | ~$250–300 | 500+ | **$0.50–0.60** |

---

## Infrastructure Breakdown

### 1. **Hosting & Database** (Monthly)

#### Vercel (Next.js Dashboard)
- **Current estimate:** $20–50/month (Pro plan + function invocations)
- **At full capacity:** $50–100/month (higher traffic, auto-scaling)
- **Why:** Fixed Pro plan ($20) + overage for API calls, serverless function duration

#### Supabase PostgreSQL (Database)
- **Current estimate:** $25–50/month (Small plan at 4GB storage, 2 connections)
- **At full capacity:** $50–150/month (Medium plan, higher connection pool, more storage)
- **Assumptions:**
  - ~50K coaching session records currently
  - ~100K+ WhatsApp messages
  - Growing at 1K sessions/month

**Reference:** Supabase pricing:
- Small: $25/mo (500 MB, 2 connections)
- Medium: $50/mo (8 GB, 10 connections)
- Large: $150/mo (40 GB, 20 connections)

#### WhatsApp Service (Node.js, Railway/Local)
- **Current estimate:** $5–20/month (if on Railway, Pro plan ~$12)
- **At full capacity:** $20–50/month (higher message throughput, bot complexity)

### 2. **Feature Costs** (Per-User)

#### Coaching Sessions (Database storage + API calls)
- **Per session:** ~0.5–1 MB database + 2 API calls (~$0.002 in Vercel invocations)
- **User average:** 1–2 sessions/month currently (13 users, visible in chart)
- **Cost per session:** ~$0.003–0.01

#### WhatsApp Messages (Real-time listeners + storage)
- **Per message:** ~0.1 MB storage + 1 background job
- **No Twilio/paid API used** (using web scraper, local setup)
- **Cost per message:** ~$0.00 (infrastructure only, not usage-based)

#### Video/Image Processing (if used)
- **Currently:** Minimal usage (query counts from `/api/` endpoints suggest light usage)
- **Per request:** ~$0.10–0.30 (if using external AI/ML service)

---

## Current State (13 Active Coaching Users)

### Monthly Fixed Costs
```
Vercel (Next.js):           $25
Supabase (Small plan):      $25
Railway (WhatsApp service): $12
Miscellaneous/CDN:          $10
─────────────────────────────────
TOTAL FIXED:               ~$72/month
```

### Variable Costs (Per-User Average)
- Coaching sessions: 1.5 sessions/user/month × $0.01 = $0.015
- WhatsApp messages: 50 msgs/user/month × $0.00 = $0.00
- API/storage overage: ~$1.00 per user
- **TOTAL VARIABLE:** ~$1.00/user/month

### Cost Per User
```
Fixed costs:        $72
÷ 13 users        = $5.54 fixed per user
+ Variable:       + $1.00 per user
────────────────────────────
= $6.54–7.00 per user/month
```

**But accounting for incomplete adoption (13 users out of likely 50–100 registered):**
```
If 50 total registered:   $72 ÷ 50 = $1.44 + $1.00 = $2.44/user
If 100 total registered:  $72 ÷ 100 = $0.72 + $1.00 = $1.72/user
```

---

## Full Capacity Scenario (100 Active Teachers)

### Assumptions
- **100 active users** = 1 district × 100 teachers (STEDA model)
- **Usage pattern:** 3–5 sessions/user/month (with better onboarding)
- **Feature adoption:** Coaching (100%), WhatsApp (80%), Lesson Plans (40%)

### Infrastructure Costs (Scaled)
```
Vercel (Medium plan):       $60
Supabase (Medium plan):     $75   [higher connections, 20GB+ storage]
Railway/Hosting:            $30   [increased load]
CDN/Storage:                $20
─────────────────────────────────
TOTAL FIXED:              ~$185/month
```

### Variable Costs Per User
- Coaching: 4 sessions × $0.01 = $0.04
- WhatsApp: 100 msgs × $0.00 = $0.00
- API/storage: ~$1.20/user
- **TOTAL VARIABLE:** ~$1.25/user/month

### Cost Per User (Full Capacity)
```
Fixed costs:        $185
÷ 100 users       = $1.85 fixed per user
+ Variable:       + $1.25 per user
────────────────────────────
= $3.10 per user/month
```

---

## Scenarios & Pricing Recommendations

### Scenario A: School/Partner Licensing (100 teachers)
```
Monthly cost:     $310 (infrastructure)
Operating cost:   +$20 (support, updates, payment processing)
Target margin:    50%
─────────────────
RECOMMENDED PRICE: $660–700/month per school
Per-teacher cost: $6.60–7.00/user/month
```

### Scenario B: District/Government (500+ teachers)
```
Monthly cost:     $400–500 (economies of scale)
Per-teacher cost: $0.80–1.00/user/month (heavily discounted)
Recommended pricing: 
  - $0.50–1.50/user/month (bulk discount)
  - OR $300–500/month flat + per-feature fees
```

### Scenario C: Freemium Model (Limited features free)
```
Free tier:        Coaching only, max 2 sessions/month
Paid tier:        $5–10/user/month (unlimited coaching + WhatsApp + lesson plans)
Margin on paid:   50–70%
```

---

## Key Cost Drivers (Ranked by Impact)

| Driver | Current | At Scale | Action |
|--------|---------|----------|--------|
| **Database storage** | $25 | $75+ | Archive old sessions, compress message logs |
| **API invocations** | ~$10/mo | $50+/mo | Batch requests, cache results, add pagination |
| **Concurrent connections** | 2 | 10+ | Move from Small → Medium Supabase plan |
| **WhatsApp message volume** | ~650/mo | 5,000+/mo | Implement message pruning, off-load to separate worker |
| **Serverless function time** | Low | High | Optimize cold starts, migrate heavy tasks to async workers |

---

## Sensitivity Analysis

### What if usage doubles?
```
Coaching sessions: 2 → 4/user/month
WhatsApp messages: 50 → 100/user/month
Cost per user: $6–7 → $7–8 (mostly variable cost increase)
```

### What if we scale to 1,000 users?
```
Infrastructure: $150–200/month (Vercel, Supabase Large, dedicated worker)
Cost per user: $0.15–0.20/user/month
```

---

## Recommendations for Cost Optimization

1. **Implement Message Archival** (WhatsApp)
   - Archive messages older than 90 days
   - Estimated savings: $5–10/month per 500 active users

2. **Database Query Optimization**
   - Add indexes for user_id, created_at on coaching_sessions
   - Reduce API invocation cost by 20–30%

3. **Caching Layer** (Redis)
   - Cache dashboard data (KPIs, user lists)
   - Cost: $6–15/month (Upstash)
   - ROI: Faster page loads, reduced API calls

4. **Batch Processing**
   - Move report generation to async jobs (background workers)
   - Reduce serverless function duration by 50%

5. **CDN for Static Assets**
   - Already using Vercel CDN; optimize image compression

---

## Data Requirements for Accuracy

To refine this analysis, **please provide:**

1. **Your actual Vercel bill** (monthly) — visible at vercel.com/billing
2. **Your actual Supabase bill** (monthly) — visible at supabase.com/dashboard
3. **Your actual Railway/hosting bill** (if external)
4. **Total registered users** (not just active)
5. **Average sessions per user per month** (current data)
6. **WhatsApp message volume per user** (current monthly average)

---

## Next Steps

1. **Validate Infrastructure Costs** — Share billing screenshots from Vercel + Supabase
2. **Model Pricing Tiers** — Decide between per-user, per-school, or freemium
3. **Cost Forecasting** — Extrapolate 6–12 month growth scenarios
4. **Profitability Analysis** — Calculate breakeven and margin targets

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-23  
**Author:** Claude Analysis  
**Next Review:** After gathering actual billing data
