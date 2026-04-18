import { NextResponse } from 'next/server'
import path from 'path'
import fs   from 'fs'

export const dynamic = 'force-dynamic'

// Module-level flag — prevents re-spawning during the same server process lifetime.
// Resets automatically when Next.js hot-reloads the module.
let spawned = false

/** Kill the Chrome process that owns the stale DevTools port and delete lock files. */
async function cleanStaleLock(sessionDir: string) {
  try {
    const portFile = path.join(sessionDir, 'DevToolsActivePort')
    if (fs.existsSync(portFile)) {
      const port = parseInt(fs.readFileSync(portFile, 'utf-8').split('\n')[0].trim(), 10)
      if (!isNaN(port)) {
        // Find PID via netstat, then kill it
        const { execSync } = await import('child_process')
        try {
          const netstat = execSync(`netstat -ano`, { encoding: 'utf-8' })
          const match = netstat.split('\n').find(l => l.includes(`:${port} `) && l.includes('LISTENING'))
          if (match) {
            const pid = match.trim().split(/\s+/).pop()
            if (pid && /^\d+$/.test(pid)) {
              try {
                execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf-8' })
                console.log(`[wa/launch] Killed stale Chrome PID ${pid} (port ${port})`)
              } catch {}
            }
          }
        } catch {}
      }
    }

    // Delete all Chrome lock files
    for (const f of ['DevToolsActivePort', 'lockfile', 'SingletonLock', 'SingletonCookie']) {
      const fp = path.join(sessionDir, f)
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp) } catch {}
    }
  } catch (e) {
    console.warn('[wa/launch] cleanStaleLock error:', e)
  }
}

export async function POST() {
  // On Vercel the service runs elsewhere — skip spawn
  if (process.env.VERCEL) {
    return NextResponse.json({ ok: false, reason: 'vercel' })
  }

  if (spawned) {
    return NextResponse.json({ ok: true, reason: 'already_running' })
  }

  try {
    const serviceDir  = path.resolve(process.cwd(), '..', 'whatsapp-service')
    const serviceFile = path.join(serviceDir, 'index.js')
    const sessionDir  = path.join(serviceDir, '.wwebjs_auth', 'session')

    // Kill any stale Chrome process and remove lock files before starting
    await cleanStaleLock(sessionDir)

    const { spawn } = await import('child_process')

    const child = spawn('node', [serviceFile], {
      cwd:      serviceDir,
      detached: true,
      shell:    process.platform === 'win32', // needed on Windows to find node in PATH
      stdio:    'ignore',
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
