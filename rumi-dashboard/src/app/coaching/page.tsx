import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/auth'
import CoachingDashboard from '@/components/coaching/CoachingDashboard'

export const dynamic = 'force-dynamic'

export default async function CoachingPage() {
  const token = cookies().get('session')?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) redirect('/login')

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-gray-950">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <CoachingDashboard role={session.role} />
      </div>
    </main>
  )
}
