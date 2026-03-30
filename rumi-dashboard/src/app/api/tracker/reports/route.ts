import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { pool } from '@/lib/db'
import { TrackerReport } from '@/lib/pdf/TrackerReport'
import React from 'react'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const [snapshotRes, milestonesRes, actionsRes] = await Promise.all([
      pool.query(`SELECT * FROM metric_snapshots ORDER BY snapshot_date DESC LIMIT 1`),
      pool.query(`SELECT * FROM plan_milestones ORDER BY sort_order`),
      pool.query(`SELECT * FROM action_items WHERE status='open' ORDER BY due_date ASC NULLS LAST`),
    ])

    const pdfBuffer = await renderToBuffer(
      React.createElement(TrackerReport, {
        snapshot:      snapshotRes.rows[0]  ?? null,
        milestones:    milestonesRes.rows,
        actions:       actionsRes.rows,
        generatedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      })
    )

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="STEDA-Tracker-${new Date().toISOString().slice(0,10)}.pdf"`,
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
