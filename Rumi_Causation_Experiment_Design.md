# Rumi Platform — Randomized Controlled Experiment Design
## "Does Video Generation *Cause* Retention, or Do High-Intent Users Self-Select?"

**Document Type:** Experiment Design / Research Protocol  
**Date:** April 28, 2026  
**Based On:** Video_Retention_Analysis_Report.pdf — Correlation Analysis  
**Primary Question:** Does introducing video generation to a user *cause* them to stay longer, or does the correlation exist because motivated, high-intent users naturally discover video on their own?

---

## 1. THE CAUSAL PROBLEM

### What the correlation tells us
Our observational data shows:
- LP→Video users: 9.1 avg active days, 12% week-8 retention
- LP-only users: 2.9 avg active days, 3.2% week-8 retention
- Correlation r = 0.263, p < 0.001

### Why correlation ≠ causation here
Three competing explanations are equally consistent with the data:

| # | Explanation | Mechanism | What it implies |
|---|-------------|-----------|-----------------|
| A | **Video causes retention** | Video provides ongoing value that makes users return | Expanding video access will boost retention for everyone |
| B | **Selection bias** | High-intent teachers who plan to stay long are more likely to explore video | Expanding video access won't change retention for low-intent users |
| C | **Reverse causation** | Users who already stayed long eventually discover video | Promoting video early to new users won't replicate the effect |

A randomized experiment is the **only reliable way** to isolate explanation A from B and C.

---

## 2. EXPERIMENT OVERVIEW

| Field | Detail |
|-------|--------|
| **Type** | Randomized Controlled Trial (RCT) with 3 treatment arms + 1 control |
| **Target Population** | LP-only users — 1,934 users who completed ≥1 lesson plan but never tried video |
| **Rationale for Target** | They are the most tractable group — already engaged, largest pool, and the data shows the LP→Video transition is where retention is gained |
| **Primary Outcome** | Week-8 cohort retention (% of users active 8 weeks after treatment date) |
| **Secondary Outcomes** | Active days (weeks 1–8), video completions, lesson plan completions, total conversations |
| **Sample Size Required** | ~800 users per arm (see Section 6) |
| **Duration** | 12 weeks (4-week enrollment + 8-week observation) |
| **Unit of Randomization** | Individual user (not school or cohort) |

---

## 3. FOUR COMPETING HYPOTHESES TO TEST

**H0 (Null):** Prompting LP-only users to try video generation has no effect on their retention at week 8.

**H1 (Feature Value):** Video generation provides genuine pedagogical value. When users experience it, they find reasons to return. Retention improves *because of what video offers*, not who chooses it.

**H2 (Pathway Value):** The LP→Video sequence itself creates a structured learning habit. Completing lesson plans, then seeing them brought to life in video, creates a usage loop. The *transition moment* matters, not just the feature.

**H3 (Onboarding Value):** Low-intent users who never tried video simply weren't aware of it or didn't know how to start. Reducing friction (tutorial, prompt, in-context suggestion) causes adoption, and adoption causes retention.

Each treatment arm is designed to test a different one of these mechanisms.

---

## 4. EXPERIMENTAL DESIGN — FOUR ARMS

### ARM A: Control (No Intervention)
**n = 400 users**

Users experience the current Rumi platform exactly as-is. No nudge, no mention of video, no onboarding change. This is the baseline against which all treatment effects are measured.

**What it tests:** Establishes the natural baseline retention curve for LP-only users without any manipulation. Any improvement in treatment arms above this baseline is attributable to the intervention.

**Expected outcome (based on existing data):** ~20% week-1 retention, ~3.2% week-8 retention, ~2.9 active days.

---

### ARM B: Feature Awareness Nudge (Tests H3 — Awareness/Friction)
**n = 400 users**

A single WhatsApp message sent 48 hours after their most recent lesson plan completion:

> *"[Name], your lesson plan is ready. Did you know Rumi can also generate a short video to go with it? Try it now — just send: 'Make a video for [topic]'*"

**Mechanism being tested:** Is the only barrier awareness? If arm B significantly outperforms arm A, it means friction and discoverability are the root cause. The feature is valuable but hidden.

**Implementation requirements:**
- Query: users in experiment who completed a lesson plan in the last 24h
- Trigger: send WhatsApp message via existing `whatsapp-service/`
- Timing: 48 hours after lesson plan completion (not immediate — let them process it first)
- Frequency: once only (not repeated nudging)

**Key signal:** If week-8 retention in arm B ≈ arm A → awareness alone doesn't explain the correlation. If arm B >> arm A → discoverability is the bottleneck.

---

### ARM C: In-Context Suggestion at LP Completion (Tests H2 — Pathway/Sequence)
**n = 400 users**

When a user's lesson plan is delivered, the completion message is augmented with a specific, lesson-aware video suggestion:

> *"Your lesson plan on [topic] for Grade [X] is ready! One more step to bring this to life: Rumi can generate a 2-minute explainer video your students can watch. Reply 'Make video' to create it now."*

The video is offered as a *natural continuation* of the lesson plan — making the LP→Video sequence feel like a single workflow, not two separate features.

**Mechanism being tested:** Does the *sequence context* matter? This arm differs from arm B in that the prompt arrives at the exact moment of LP completion (not 48h later), and explicitly frames video as step 2 of a workflow. If arm C >> arm B, the *timing and framing* of the transition matters as much as the awareness.

**Implementation requirements:**
- Modify lesson plan completion message in API delivery code
- Requires conditional logic: only for users in arm C of the experiment
- Message must be personalized with the actual LP topic and grade
- A/B flag per user in database (new `experiment_arm` column on `users` table or separate `experiments` table)

**Key signal:** If arm C >> arm B → the pathway framing (not just awareness) drives adoption and retention. The LP→Video progression needs to be engineered, not just announced.

---

### ARM D: Video-First Onboarding Tutorial (Tests H1 — Feature Value / Competence)
**n = 400 users**

An onboarding-style WhatsApp sequence (3 messages over 3 days) that teaches the user *how* to use video generation and *why* it helps students:

- **Day 1:** "Here's what Rumi video generation can do [example video link or description]. This is how one teacher in your region used it last week."
- **Day 2:** "To create a video, just send: 'Create a 2-minute video about photosynthesis for Grade 5'. Try it now."
- **Day 3 (only if no video attempt):** "Your students remember 65% more when they watch a short video vs reading. Ready to try? Send any topic."

This arm does not tie video to a specific lesson plan moment. It provides motivation, social proof, and step-by-step guidance as a standalone educational sequence.

**Mechanism being tested:** Does the intrinsic value of video — once clearly explained and demonstrated — drive adoption and retention? If arm D >> arm A but arm D ≈ arm B/C, the content itself drives value (not just sequence or timing). If arm D > all others, the barrier is lack of *perceived value*, not discoverability.

**Implementation requirements:**
- Scheduled message queue in `whatsapp-service/`
- Conditional send (skip day 2/3 if user already sent a video request)
- Social proof message requires a real anonymized example from existing LP→Video users

**Key signal:** Highest-cost arm. If arm D outperforms all others, invest in onboarding. If arm D ≈ arm B or C, the simpler/cheaper nudge is equally effective.

---

## 5. RANDOMIZATION STRATEGY

### Unit and method
Randomize at the **individual user level** using a deterministic hash of user UUID:

```python
import hashlib

def assign_arm(user_id: str) -> str:
    """Deterministically assign user to experiment arm."""
    experiment_salt = "rumi-video-rct-2026-v1"
    hash_val = int(hashlib.md5(f"{experiment_salt}-{user_id}".encode()).hexdigest(), 16)
    bucket = hash_val % 4
    return ["control", "arm_b_nudge", "arm_c_context", "arm_d_onboarding"][bucket]
```

This ensures:
- Assignment is reproducible (same user always maps to same arm)
- No database write needed at enrollment time
- Distribution is approximately uniform (25%/25%/25%/25%)
- Can be verified before launch by dry-running on existing user IDs

### Eligibility criteria (at time of enrollment)
Users must meet ALL of the following to be enrolled:
1. `COALESCE(is_test_user, false) = false`
2. At least 1 completed `lesson_plan_request`
3. Zero completed `video_requests` (never tried video)
4. Account created ≥ 7 days ago (exclude brand-new users in onboarding chaos)
5. Sent at least 1 message in the past 14 days (exclude already-churned users)
6. `registration_completed = true` (exclude unregistered users who may not understand the platform)

### Baseline check (pre-experiment)
Before launching, verify that the 4 arms are statistically equivalent on:
- Average lesson plans completed
- Account age (days since `users.created_at`)
- Active days in the 4 weeks before enrollment
- Registration status breakdown
- Organization/partner breakdown

Run chi-squared and Kruskal-Wallis tests. If any arm differs significantly (p < 0.05), re-randomize with a different salt.

---

## 6. SAMPLE SIZE & STATISTICAL POWER

### Assumptions
Based on existing LP-only baseline data:
- **Baseline week-8 retention:** 3.2% (arm A expected)
- **Minimum detectable effect:** We want to detect if any arm reaches ≥ 7% week-8 retention (a 2x lift — practically meaningful for the business)
- **Statistical power (1-β):** 80%
- **Significance level (α):** 0.05 (two-tailed)
- **Test:** Chi-squared test of proportions (binary outcome: retained at week 8 yes/no)

### Calculation
```
n = (Z_α/2 + Z_β)² × [p1(1-p1) + p2(1-p2)] / (p1 - p2)²

Where:
  Z_α/2 = 1.96 (two-tailed α=0.05)
  Z_β   = 0.84 (power = 0.80)
  p1    = 0.032 (control: 3.2%)
  p2    = 0.070 (treatment: 7.0%)

n ≈ (1.96 + 0.84)² × [0.032×0.968 + 0.070×0.930] / (0.032 - 0.070)²
n ≈ 7.84 × [0.031 + 0.065] / 0.001444
n ≈ 7.84 × 0.096 / 0.001444
n ≈ 521 per arm
```

**Recommendation: 600 users per arm** (buffer for dropout, ineligibility at enrollment time, and potential SUTVA violations). Total: 2,400 users.

**Available pool:** 1,934 LP-only users. With eligibility filters (active in last 14 days, registered), the eligible pool will be approximately 800–1,200 users. This means:
- You may only be able to run 2 treatment arms vs control simultaneously
- **Prioritize arms B and C first** (cheapest to implement, most distinct hypotheses)
- Run arm D in a follow-up experiment if B/C show a significant effect

---

## 7. TIMELINE

### Phase 1 — Preparation (Weeks 1–2)

| Task | Owner | Notes |
|------|-------|-------|
| Add `experiment_arm` column to users or create `experiments` table | Engineering | Stores arm assignment + enrollment date |
| Implement arm assignment logic (hash function above) | Engineering | Must be deployed before enrollment |
| Audit eligible users against eligibility criteria | Analytics | Verify pool size before committing |
| Baseline balance check | Analytics | Verify 4 arms are statistically equivalent |
| Build scheduled message delivery in whatsapp-service | Engineering | Arms B, C, D each need message triggers |
| Write and review message copy for all 3 treatment arms | Product | Critical — test copy with 2–3 real teachers before launch |
| Ethics review | Leadership | Informed consent? Data handling? |
| Pre-register the experiment | Analytics | Write down hypotheses BEFORE seeing data to prevent HARKing |

### Phase 2 — Enrollment (Weeks 3–6, rolling)

- Enroll eligible users as they complete new lesson plans (not all at once)
- Rolling enrollment: when a qualifying user completes a lesson plan, check eligibility → assign arm → log enrollment date
- Cap at 600 per arm — once an arm is full, stop enrolling to it
- Monitor enrollment rate weekly. If too slow, loosen eligibility criteria (e.g., drop the "active in 14 days" requirement)

### Phase 3 — Observation (Weeks 7–14)

- Lock enrollment: no new users added after week 6
- Monitor message delivery success rates (failed WhatsApp sends must be logged)
- Track video_request creation events daily
- Weekly interim analysis at weeks 2 and 4 post-treatment (not for stopping — for health monitoring only)
- **No peeking rule:** Do not run the primary analysis until week 8 post-enrollment is complete for all enrolled users. Early peeking inflates false positive rate.

### Phase 4 — Analysis (Weeks 15–16)

- Primary analysis: week-8 retention by arm (chi-squared test)
- Secondary analysis: active days survival curves, time-to-first-video, video→LP feedback loops
- Heterogeneous treatment effects: does the effect differ by partner/organization? By account age? By teacher grade level?
- Write up findings and share with stakeholders

---

## 8. OUTCOME METRICS

### Primary Outcome
| Metric | Definition | When measured |
|--------|-----------|---------------|
| **Week-8 Retention** | % of arm users with ≥1 conversation in week 8 after enrollment | 8 weeks post-enrollment |

### Secondary Outcomes (all measured at week 8 unless noted)
| Metric | Definition | Why it matters |
|--------|-----------|----------------|
| Week-1, 2, 4 retention | Retention at earlier timepoints | Characterizes the retention curve shape, not just endpoint |
| Video adoption rate | % of arm users who completed ≥1 video_request | Measures whether nudge actually caused video trial |
| Active days | COUNT(DISTINCT conversation date) in 8-week window | Higher resolution than binary retention |
| Active weeks | COUNT(DISTINCT week) with ≥1 message | Measures consistency of engagement |
| Lesson plan requests (post-enrollment) | Count of LPs created after enrollment | Does video adoption suppress or enhance LP use? |
| Time to first video | Days from enrollment to first video_request | If treatment arm reduces this, nudge reduced friction |
| Messages sent | Total conversations.role='user' count | Breadth of engagement |

### Guardrail Metrics (should NOT change)
| Metric | Direction | Why it's a guardrail |
|--------|-----------|----------------------|
| Lesson plan completion rate | Must not decrease | We don't want nudging toward video to crowd out LP usage |
| Negative feedback / opt-outs | Must not increase | Nudging must not feel spammy or intrusive |
| WhatsApp message open rate | Should increase or stay flat | If drop → message is being ignored or blocked |

---

## 9. ANALYSIS PLAN

### Primary analysis
Chi-squared test comparing arm A (control) vs each treatment arm on week-8 binary retention:

```python
from scipy.stats import chi2_contingency, fisher_exact
import pandas as pd

def compare_retention(control_retained, control_total, treatment_retained, treatment_total):
    """Chi-squared test for retention rate difference."""
    table = [
        [treatment_retained, treatment_total - treatment_retained],
        [control_retained, control_total - control_retained]
    ]
    chi2, p_value, dof, expected = chi2_contingency(table)
    
    control_rate = control_retained / control_total
    treatment_rate = treatment_retained / treatment_total
    relative_lift = (treatment_rate - control_rate) / control_rate

    return {
        'control_rate': control_rate,
        'treatment_rate': treatment_rate,
        'relative_lift': f"{relative_lift:.1%}",
        'chi2': chi2,
        'p_value': p_value,
        'significant': p_value < 0.05
    }
```

### Multiple comparisons correction
We are running 3 independent tests (B vs A, C vs A, D vs A). Apply **Bonferroni correction**: 
- Adjusted α = 0.05 / 3 = 0.017 per test
- A result is only declared significant if p < 0.017

### Mediation analysis (key causal test)
This is the most important analysis. It answers: **"Does video adoption *mediate* the relationship between the intervention and retention?"**

If the causal chain is: Nudge → Video Adoption → Retention
Then:
1. Nudge must predict video adoption (check)
2. Video adoption must predict retention (already shown in observational data)
3. Nudge's effect on retention should reduce (or disappear) when we control for video adoption

```
Step 1: Regress video_adopted ~ arm_assignment        (arm predicts video adoption)
Step 2: Regress retained_week8 ~ arm_assignment       (arm predicts retention)
Step 3: Regress retained_week8 ~ arm + video_adopted  (arm + video predicts retention)

If coefficient on arm_assignment becomes non-significant in Step 3 → full mediation
If coefficient shrinks but remains significant → partial mediation
If coefficient unchanged → video adoption does NOT mediate the effect
```

This tells us whether the intervention works *through* video, or through some other mechanism (e.g., just knowing Rumi cares about you is enough to feel more engaged).

### Heterogeneous treatment effects
Sub-group analyses to run:
1. **By partner/organization:** Does the effect differ for STEDA vs Taleemabad vs others?
2. **By account age:** New users (0–30 days) vs older users (30+ days) — is onboarding intervention more effective for newer users?
3. **By lesson plan volume:** Low LP users (1–2 LPs) vs high LP users (5+) — do more engaged users respond more?
4. **By region/language:** Does the message framing resonate differently across languages?

**Warning:** Sub-group analyses are exploratory. Do not use them as primary evidence. Pre-specify which sub-groups you plan to analyze before seeing the data.

### Survival analysis
Plot Kaplan-Meier retention curves for each arm over 8 weeks. This is more informative than a single week-8 snapshot because it shows:
- Whether treatment accelerates early engagement (steep week-1 effect)
- Whether treatment effect sustains or fades (divergence at week 4 vs 8)
- Whether control catches up over time (dilution of intent-to-treat effect)

---

## 10. CONFOUNDERS & THREATS TO VALIDITY

### Threat 1: Spillover / SUTVA Violation
**Risk:** If two teachers from the same school are in different arms, they may talk to each other. A teacher in arm A (control) might hear about video from their arm-C colleague and try it anyway.

**Mitigation:** Analyze contamination by tracking video adoption in the control arm. If control arm video adoption rate > 5%, run a sensitivity analysis excluding schools with cross-arm exposure.

**Note on WhatsApp group:** The Rumi WhatsApp group may spread awareness of video features organically. Monitor WhatsApp group message volume for any viral "did you try Rumi video?" conversations.

### Threat 2: Non-Compliance
**Risk:** Treatment users who receive the nudge may ignore it. Control users may stumble upon video anyway.

**Mitigation:** Analyze both **Intent-to-Treat (ITT)** and **Complier Average Causal Effect (CACE)**:
- ITT: compare arms as-assigned (ignores whether they actually watched the message or used video)
- CACE: among users who *actually adopted video*, what is the causal effect? (Use arm assignment as an instrumental variable)

### Threat 3: Hawthorne Effect
**Risk:** Simply being nudged (any nudge) makes users feel more "seen" and more likely to return to the platform — even if the video feature itself has no value. This would inflate all treatment arms equally.

**Detection:** If all 3 treatment arms outperform control by similar margins, and video adoption rates are similar across treatment arms but retention differs → Hawthorne effect is likely.

**Mitigation:** Consider adding an **attention control arm** — a 5th arm that receives a general "we're here to help, keep using Rumi" message with no video mention. If this arm performs like arms B/C/D, the effect is Hawthorne, not video.

### Threat 4: Novelty Effect
**Risk:** The short-term boost from trying a new feature (video) fades after a few uses. Week-8 retention may not reflect long-term retention.

**Mitigation:** Plan a 6-month follow-up analysis on the same cohort. Check whether week-8 retention translates to month-3 and month-6 retention.

### Threat 5: Differential Attrition
**Risk:** If treatment arm users churn *before* they can try video (e.g., teacher goes on holiday), the experiment underestimates the true effect.

**Detection:** Compare early churn rates (week 0–2) across arms. If treatment arms show higher early churn (unlikely but possible), investigate message delivery issues.

---

## 11. DECISION FRAMEWORK — WHAT TO DO WITH RESULTS

### Outcome Matrix

| Result | Interpretation | Decision |
|--------|---------------|----------|
| All arms ≈ control | No causal effect of any nudge. Correlation is selection bias. | Do NOT invest in video promotion. Focus on other retention drivers. |
| Arm B >> control, C ≈ B, D ≈ B | Awareness/friction is the only bottleneck. Simple nudge is enough. | Deploy the arm-B message at scale. Low cost, high ROI. |
| Arm C >> arm B >> control | Pathway/sequence framing matters. In-context LP+video integration drives adoption. | Redesign the lesson plan completion flow to always suggest video as step 2. |
| Arm D >> all | Perceived value + social proof is the bottleneck. Users needed to understand *why*. | Invest in onboarding video education. May require teacher training resources. |
| Arms B+C >> control but D ≈ control | Contextual, timely nudges work. Standalone educational content does not. | Simple contextual prompt is best. Avoid heavy onboarding investment. |
| All treatment arms >> control but mediation analysis shows no mediation through video | Something else is happening (Hawthorne, attention, feeling supported). | Run the attention control. Dig into what specifically arms B/C/D share. |

### Minimum Viable Result to act
To justify a product change (making the arm C or B behavior the default for all new LP users):
- p < 0.017 on primary outcome
- Absolute week-8 retention improvement ≥ 2 percentage points (from 3.2% to ≥ 5.2%)
- No significant harm to guardrail metrics
- Effect holds for at least 2 sub-groups (partner, region) to ensure generalizability

---

## 12. IMPLEMENTATION CHECKLIST

### Engineering (2 weeks pre-launch)
- [ ] Create `user_experiments` table: `(user_id, experiment_id, arm, enrolled_at, video_adopted_at, status)`
- [ ] Implement arm assignment hash function (deterministic, reproducible)
- [ ] Build message trigger in `whatsapp-service/`: fires on `lesson_plan_requests.status = 'completed'` for enrolled users
- [ ] Arm C: modify lesson plan completion message conditionally for arm-C users
- [ ] Arm D: schedule 3-day message sequence with early-exit if video adopted
- [ ] Logging: every message sent to experiment users must be logged with timestamp
- [ ] Instrument `video_requests` creation events with experiment arm tag

### Analytics (1 week pre-launch)
- [ ] Pre-register hypotheses in a shared document (Notion, Google Doc) with today's date
- [ ] Write SQL to compute all outcome metrics at weeks 1, 2, 4, 8
- [ ] Build a monitoring dashboard: daily enrollment counts, message delivery rate, video adoption rate by arm (no peeking at retention until week 8!)
- [ ] Confirm sample size estimate with actual eligible user count from DB

### Product / Content (1 week pre-launch)
- [ ] Write message copy for all 3 treatment arms
- [ ] Test messages with 2–3 real teachers (is the language natural? Does it feel helpful or spammy?)
- [ ] Translate messages to Urdu/Sindhi if teachers prefer
- [ ] Set up opt-out mechanism: users who reply "STOP" should exit the experiment and receive no more messages

### Leadership sign-off
- [ ] Communicate experiment to relevant stakeholders (STEDA partners, Taleemabad team)
- [ ] Confirm consent/disclosure approach: do users need to know they're in an experiment?
- [ ] Agree on success criteria and the decision framework (section 11 above) before launch

---

## 13. ETHICAL CONSIDERATIONS

### Is it ethical to withhold a potentially helpful feature from control users?
**Yes**, with justification: The control group receives the *current* platform experience, which is already what all LP-only users receive today. We are not withholding anything they currently have access to. If the experiment proves video causes retention, we immediately deploy the winning arm to all users.

### Informed consent
Rumi is a conversational WhatsApp-based product. Standard practice in product experimentation is to include experiment disclosure in the Terms of Service rather than per-experiment consent. However, given that Rumi serves teachers in Pakistan (potentially vulnerable population in terms of digital literacy), consider:
- Adding a one-time disclosure: "We occasionally test new features to improve your Rumi experience."
- Ensuring all messages have a clear opt-out option.

### Data privacy
- Experiment arm assignments must be stored internally and never shared with partner organizations (STEDA, TCF, etc.)
- Analysis data must be anonymized before sharing in reports (no individual teacher names linked to experimental outcomes)

---

## 14. BEYOND THE EXPERIMENT — A CAUSAL RESEARCH AGENDA

This RCT answers whether *introducing* video causes retention. Once completed, the following questions remain:

| Question | Method |
|----------|--------|
| Which *type* of video drives the most retention? | Within-experiment analysis of video content topics |
| Does video quality matter, or just having watched one? | Compare users with 1 video vs 5+ videos |
| Is the LP→Video loop self-reinforcing? | Time-series analysis: does video usage predict more LP usage? |
| What is the decay rate? Does video retention advantage persist at 6 months? | Long-run cohort follow-up |
| Can we predict *who* will benefit from the video nudge? | Machine learning propensity model on pre-experiment features |
| Is there a teacher peer-effect? (Does one teacher showing video to a colleague create spillover?) | Network analysis on WhatsApp group interactions |

---

## SUMMARY

| Item | Details |
|------|---------|
| **Question** | Does video generation *cause* retention, or is the correlation selection bias? |
| **Design** | 4-arm RCT (1 control + 3 treatment interventions) |
| **Population** | 1,934 LP-only users who never tried video |
| **Sample Size** | 600/arm (2,400 total; may downscale to 3 arms given pool constraints) |
| **Timeline** | 12 weeks total (2 prep + 4 enrollment + 6 observation + 2 analysis) |
| **Primary Metric** | Week-8 cohort retention |
| **Key Analysis** | Chi-squared + mediation analysis (does video adoption mediate the effect?) |
| **Decision threshold** | p < 0.017 (Bonferroni corrected) + ≥2pp absolute retention lift |
| **Expected start date** | ~May 15, 2026 (2 weeks for implementation) |
| **Expected read-out** | ~August 10, 2026 |
| **Cost** | Engineering: ~2 weeks of effort. Ongoing: 0 (uses existing WhatsApp infrastructure) |

---

*Document prepared by: Rumi Analytics — April 28, 2026*  
*Based on: Video_Retention_Analysis_Report.pdf — Observational Correlation Study*
