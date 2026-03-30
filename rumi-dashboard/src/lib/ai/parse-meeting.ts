import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ParsedMeeting {
  title: string
  meeting_date: string // YYYY-MM-DD
  participants: string[]
  summary: string
  action_items: {
    text: string
    owner: string
    due_date: string | null
    priority: 'high' | 'medium' | 'low'
    category: string
  }[]
  kpi_updates: { metric_key: string; value: number; note: string }[]
  milestone_updates: { phase: string; status: 'done' | 'in_progress' | 'at_risk' | 'upcoming'; note: string }[]
}

const SYSTEM_PROMPT = `You are a deployment plan analyst for Taleemabad's STEDA × Rumi pilot in Sindh, Pakistan.
You receive Fathom meeting recap emails and extract structured data to update the deployment tracker.

CONTEXT:
- 1,346 teachers in STEDA cohort, target 75% joined
- Key features: Lesson Plans, Coaching, Video, Attendance+Quiz (upcoming)
- Call 1: April 2 2026 — LP + Coaching. Call 2: mid-May — Attendance+Quiz
- April 10: Month 1 Fidelity Report to ED Rasool Bux

PEOPLE: Junaid Ali (STEDA lead), Haroon Yasin (leadership), Waqas (WhatsApp support), Mahnoor (branding), ED Rasool Bux (STEDA ED, external), AD Mazhar Sherazi (STEDA AD, external)

KPI METRIC KEYS (use exactly): joined_pct, used_any_pct, lp_pct, lp_completion, coaching_pct, video_completion, master_trainers, observation_submissions

PHASE CODES: 1a, 1b, call1, call2, mt, observation, prep_call2, phase2, contract, report

CATEGORY CODES: registration, coaching, lp, observation, contract, call, report, mt, other

Return ONLY valid JSON matching the ParsedMeeting interface. No markdown, no explanation.`

export async function parseMeetingMinutes(emailBody: string): Promise<ParsedMeeting> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Parse this Fathom meeting recap and return structured JSON:\n\n${emailBody}` }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(text) as ParsedMeeting
  } catch {
    // Retry with correction
    const retry = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Parse this Fathom meeting recap and return structured JSON:\n\n${emailBody}` },
        { role: 'assistant', content: text },
        { role: 'user', content: 'Fix and return only valid JSON:' },
      ],
    })
    const retryText = retry.content[0].type === 'text' ? retry.content[0].text : ''
    return JSON.parse(retryText) as ParsedMeeting
  }
}
