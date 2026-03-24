import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/auth'
import CoachingDashboard from '@/components/coaching/CoachingDashboard'

export default async function CoachingPage() {
  const token = cookies().get('session')?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) redirect('/login')

  return (
    <main className="max-w-screen-2xl mx-auto px-6 py-8">
      <CoachingDashboard role={session.role} />
    </main>
  )
}
