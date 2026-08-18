'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(e.currentTarget)
    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Login failed'); setLoading(false); return }
    const landing = data.role === 'steda' ? '/steda'
      : (data.role === 'principal' || data.role === 'deo') ? '/onboarding-tracker'
      : '/'
    router.push(landing)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-navy-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/rumi-mark-white-square.png" alt="Rumi" className="h-9 w-9 rounded-lg" />
          <span className="text-white text-xl font-semibold">Rumi Analytics</span>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-8 space-y-5">
          <h1 className="text-white font-semibold text-lg">Sign in</h1>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Username</label>
            <input name="username" required autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-coral transition-colors"
              placeholder="username" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Password</label>
            <input name="password" type="password" required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-coral transition-colors"
              placeholder="••••••••" />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-coral hover:opacity-90 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 text-sm transition-opacity">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
