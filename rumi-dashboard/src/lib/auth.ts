const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'rumi-dashboard-secret-2024'
)

export const USERS: Record<string, { password: string; role: 'admin' | 'steda' }> = {
  'admin':       { password: 'Admin@1122', role: 'admin' },
  'steda-admin': { password: 'steda@786',  role: 'steda' },
}

export async function createSessionToken(username: string, role: string): Promise<string> {
  const payload = btoa(JSON.stringify({ username, role, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }))
  const key = await crypto.subtle.importKey('raw', SECRET, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${payload}.${sigHex}`
}

export async function verifySessionToken(token: string): Promise<{ username: string; role: string } | null> {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return null
    const payload = token.slice(0, dotIdx)
    const sigHex  = token.slice(dotIdx + 1)
    const key = await crypto.subtle.importKey('raw', SECRET, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const sig = new Uint8Array(sigHex.match(/.{2}/g)!.map(h => parseInt(h, 16)))
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(payload))
    if (!valid) return null
    const data = JSON.parse(atob(payload))
    if (data.exp < Date.now()) return null
    return { username: data.username, role: data.role }
  } catch {
    return null
  }
}

export function validateCredentials(username: string, password: string) {
  const user = USERS[username]
  if (!user || user.password !== password) return null
  return { role: user.role }
}
