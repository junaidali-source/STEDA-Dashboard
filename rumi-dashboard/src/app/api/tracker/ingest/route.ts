import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { parseMeetingMinutes } from '@/lib/ai/parse-meeting'
import { fetchFathomEmails } from '@/lib/gmail/fetch-fathom'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const emails  = await fetchFathomEmails()
    const results = []

    for (const email of emails) {
      // Skip if already ingested
      const existing = await pool.query(
        `SELECT id FROM meeting_minutes WHERE gmail_thread_id = $1`, [email.threadId]
      )
      if (existing.rows.length > 0) continue

      const parsed = await parseMeetingMinutes(email.body)

      const meetingRes = await pool.query(
        `INSERT INTO meeting_minutes (gmail_thread_id, fathom_url, meeting_date, title, raw_transcript, summary, participants)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [email.threadId, email.fathomUrl, parsed.meeting_date, parsed.title, email.body, parsed.summary, parsed.participants]
      )
      const meetingId = meetingRes.rows[0].id

      if (parsed.action_items.length > 0) {
        for (const a of parsed.action_items) {
          await pool.query(
            `INSERT INTO action_items (meeting_id, text, owner, due_date, priority, category, status)
             VALUES ($1,$2,$3,$4,$5,$6,'open')`,
            [meetingId, a.text, a.owner, a.due_date || null, a.priority, a.category]
          )
        }
      }

      for (const upd of parsed.milestone_updates) {
        await pool.query(
          `UPDATE plan_milestones SET status=$1, actual_result=COALESCE($2, actual_result) WHERE phase=$3`,
          [upd.status, upd.note || null, upd.phase]
        )
      }

      results.push({ threadId: email.threadId, title: parsed.title, actions: parsed.action_items.length })
    }

    return NextResponse.json({ ingested: results.length, meetings: results })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
