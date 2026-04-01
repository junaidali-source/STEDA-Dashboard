export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import ActionTable from '@/components/tracker/ActionTable'

export default async function ActionsPage() {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  const { data: actions } = await supabase
    .from('action_items')
    .select('*, meeting_minutes(title, meeting_date)')
    .order('due_date', { ascending: true, nullsFirst: false })

  const rows = (actions ?? []).map((a: Record<string, unknown>) => {
    const mm = a.meeting_minutes as { title?: string; meeting_date?: string } | null
    return { ...a, meeting_minutes: undefined, meeting_title: mm?.title ?? null, meeting_date: mm?.meeting_date ?? null }
  })

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Action Items</h1>
        <p className="text-sm text-gray-500 mt-1">All action items from the deployment plan and Fathom meeting recaps</p>
      </div>
      <ActionTable actions={rows} />
    </div>
  )
}
