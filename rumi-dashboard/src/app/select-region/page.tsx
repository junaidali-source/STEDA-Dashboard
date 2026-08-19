'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PK_REGION_OPTIONS } from '@/lib/pk-regions'

export const dynamic = 'force-dynamic'

interface Session {
  role: string
  region?: string
}

function landingFor(role: string): string {
  return role === 'steda' ? '/steda'
    : (role === 'principal' || role === 'deo') ? '/onboarding-tracker'
    : role === 'regional' ? '/balochistan-pilot'
    : '/'
}

export default function SelectRegionPage() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Session | null) => {
        if (!data) { router.replace('/login'); return }
        if (!data.region) { router.replace(landingFor(data.role)); return }
        setSession(data)
        setLoading(false)
      })
      .catch(() => router.replace('/login'))
  }, [router])

  if (loading || !session) {
    return <div className="min-h-screen bg-navy-dark" />
  }

  const label = PK_REGION_OPTIONS.find((r) => r.slug === session.region)?.label ?? session.region

  return (
    <div className="min-h-screen bg-navy-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/rumi-mark-white-square.png" alt="Rumi" className="h-9 w-9 rounded-lg" />
          <span className="text-white text-xl font-semibold">Rumi Analytics</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-8 space-y-5 text-center">
          <p className="text-sm text-gray-400">Your account is set up for</p>
          <h1 className="text-white font-semibold text-2xl">{label}</h1>
          <p className="text-xs text-gray-500">
            All data on your dashboard will be scoped to this region.
          </p>

          <button
            onClick={() => router.push(landingFor(session.role))}
            className="w-full bg-coral hover:opacity-90 text-white font-medium rounded-lg py-2.5 text-sm transition-opacity"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
