import { NextResponse } from 'next/server'
import path from 'path'

export const dynamic = 'force-dynamic'

// Module-level flag — prevents spawning multiple processes if the route is called twice
let spawned = false

export async function POST() {
  // On Vercel (or any non-local environment) we cannot spawn local processes.
  // The service must already be running there.
  if (process.env.VERCEL) {
    return NextResponse.json({ ok: false, reason: 'vercel' })
  }

  if (spawned) {
    return NextResponse.json({ ok: true, reason: 'already_running' })
  }

  try {
    // Dynamic import so the module isn't bundled on Vercel
    const { spawn } = await import('child_process')

    const serviceDir  = path.resolve(process.cwd(), '..', 'whatsapp-service')
    const serviceFile = path.join(serviceDir, 'index.js')

    const child = spawn('node', [serviceFile], {
      cwd:      serviceDir,
      detached: true,
      stdio:    'ignore',
      env: {
        ...process.env,
        // Ensure dotenv picks up the root .env
        DOTENV_CONFIG_PATH: path.resolve(serviceDir, '..', '.env'),
      },
    })

    child.unref()
    spawned = true

    console.log('[wa/launch] whatsapp-service spawned, pid:', child.pid)
    return NextResponse.json({ ok: true, reason: 'spawned', pid: child.pid })
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
