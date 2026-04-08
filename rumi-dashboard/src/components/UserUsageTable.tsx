'use client'

type Row = {
  id: string
  name: string
  school_name: string
  phone_number: string
  messages: number
  lesson_plans: number
  coaching: number
  reading: number
  video: number
  image: number
  features_used: number
  total_actions: number
}

function maskPhone(p: string): string {
  if (!p || p.length < 4) return p || '-'
  return `${p.slice(0, 3)}…${p.slice(-4)}`
}

export default function UserUsageTable({ data }: { data: Row[] }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-200/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Unique user usage details</p>
        <h3 className="text-base sm:text-lg font-semibold text-slate-900 mt-1">Top active users</h3>
      </div>
      <div className="overflow-auto max-h-[520px]">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-slate-700">
            <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold whitespace-nowrap">
              <th>User</th>
              <th>School</th>
              <th>WhatsApp</th>
              <th>Total Actions</th>
              <th>Features</th>
              <th>Msgs</th>
              <th>LP</th>
              <th>Coaching</th>
              <th>Reading</th>
              <th>Video</th>
              <th>Image</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors [&>td]:px-4 [&>td]:py-2">
                <td className="font-medium text-slate-900">{r.name}</td>
                <td className="text-slate-700">{r.school_name || '-'}</td>
                <td className="text-slate-500">{maskPhone(r.phone_number)}</td>
                <td className="font-semibold text-indigo-700">{r.total_actions}</td>
                <td>{r.features_used}</td>
                <td>{r.messages}</td>
                <td>{r.lesson_plans}</td>
                <td>{r.coaching}</td>
                <td>{r.reading}</td>
                <td>{r.video}</td>
                <td>{r.image}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-500">No users found for current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

