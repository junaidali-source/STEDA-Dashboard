import {
  Users, UserCheck, MessageSquare, BookOpen, Mic, FileText, Percent,
} from 'lucide-react'

interface KPI {
  total_users: number
  registered: number
  reg_rate: number
  total_messages: number
  lesson_plans: number
  coaching: number
  reading: number
}

interface Props { data: KPI; previous?: KPI | null }

function Delta({ current, prev, isRate = false }: { current: number; prev: number; isRate?: boolean }) {
  if (prev === 0 && current === 0) return null
  const diff = current - prev
  if (diff === 0) return null
  const up = diff > 0
  const display = isRate
    ? `${Math.abs(diff).toFixed(1)}pp`
    : prev !== 0
      ? `${Math.abs(Math.round((diff / Math.abs(prev)) * 100))}%`
      : '–'
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full mt-1 inline-block ${
      up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {up ? '↑' : '↓'} {display}
    </span>
  )
}

function Card({
  label, value, icon: Icon, color, delta,
}: {
  label: string; value: string | number; icon: React.ElementType; color: string; delta?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`rounded-full p-3 ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-800 mt-0.5">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {delta}
      </div>
    </div>
  )
}

export default function KPICards({ data, previous }: Props) {
  const d = (key: keyof KPI, isRate = false) =>
    previous
      ? <Delta current={data[key] as number} prev={previous[key] as number} isRate={isRate} />
      : undefined

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      <Card label="Total Users"   value={data.total_users}    icon={Users}         color="bg-indigo-500" delta={d('total_users')} />
      <Card label="Registered"    value={data.registered}     icon={UserCheck}     color="bg-green-500"  delta={d('registered')} />
      <Card label="Reg. Rate"     value={`${data.reg_rate}%`} icon={Percent}       color="bg-teal-500"   delta={d('reg_rate', true)} />
      <Card label="Messages"      value={data.total_messages} icon={MessageSquare} color="bg-blue-500"   delta={d('total_messages')} />
      <Card label="Lesson Plans"  value={data.lesson_plans}   icon={FileText}      color="bg-purple-500" delta={d('lesson_plans')} />
      <Card label="Coaching"      value={data.coaching}       icon={Mic}           color="bg-orange-500" delta={d('coaching')} />
      <Card label="Reading Tests" value={data.reading}        icon={BookOpen}      color="bg-rose-500"   delta={d('reading')} />
    </div>
  )
}
