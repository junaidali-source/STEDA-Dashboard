export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/auth'
import ActionTable from '@/components/tracker/ActionTable'

export default async function ActionsPage() {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  let actions: never[] = []
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tracker/actions`, { cache: 'no-store' })
    if (res.ok) actions = await res.json()
  } catch {}

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Action Items</h1>
        <p className="text-sm text-gray-500 mt-1">All action items extracted from Fathom meeting recaps</p>
      </div>
      <ActionTable actions={actions} />
    </div>
  )
}
