'use client'

interface FeatureStat {
  total: number
  completed: number
  users: number
  completionPct: number
}

interface Props {
  totalListed:     number
  totalJoined:     number
  anyFeatureUsers: number
  lp:              FeatureStat
  coaching:        FeatureStat
  reading:         FeatureStat
  video:           FeatureStat
  image:           FeatureStat
}

export default function KPIBanner({
  totalListed, totalJoined, anyFeatureUsers, lp, coaching, reading, video, image,
}: Props) {
  const joinedPct      = totalListed > 0 ? Math.round(totalJoined      / totalListed * 100) : 0
  const anyFeaturePct  = totalJoined > 0 ? Math.round(anyFeatureUsers   / totalJoined * 100) : 0
  const totalRequests  = lp.total + coaching.total + reading.total + video.total + image.total
  const totalCompleted = lp.completed + coaching.completed + reading.completed + video.completed + image.completed
  const overallRate    = totalRequests > 0 ? Math.round(totalCompleted / totalRequests * 100) : 0

  const kpis = [
    { label: 'Teachers Listed',  value: totalListed.toLocaleString(),     sub: 'STEDA cohort',               borderClass: 'border-l-blue-500'  },
    { label: 'Joined Rumi',      value: totalJoined.toLocaleString(),     sub: `${joinedPct}% of listed`,    borderClass: 'border-l-teal-500'  },
    { label: 'Used Any Feature', value: anyFeatureUsers.toLocaleString(), sub: `${anyFeaturePct}% of joined`, borderClass: 'border-l-amber-400' },
    { label: 'Total Requests',   value: totalRequests.toLocaleString(),   sub: `${overallRate}% completion`,  borderClass: 'border-l-green-400' },
  ]

  const features = [
    { label: 'Lesson Plans',     users: lp.users,       total: lp.total,       pct: lp.completionPct,       dotClass: 'bg-blue-500'   },
    { label: 'Coaching',         users: coaching.users,  total: coaching.total,  pct: coaching.completionPct,  dotClass: 'bg-amber-400'  },
    { label: 'Reading',          users: reading.users,   total: reading.total,   pct: reading.completionPct,   dotClass: 'bg-violet-500' },
    { label: 'Video Generation', users: video.users,     total: video.total,     pct: video.completionPct,     dotClass: 'bg-green-400'  },
    { label: 'Image Analysis',   users: image.users,     total: image.total,     pct: image.completionPct,     dotClass: 'bg-pink-500'   },
  ]

  return (
    <div className="space-y-4">
      {/* Top-level KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className={`bg-gray-900 rounded-xl p-5 border-l-4 ${k.borderClass}`}>
            <div className="text-3xl font-bold text-white mb-1">{k.value}</div>
            <div className="text-sm font-medium text-gray-200">{k.label}</div>
            <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Per-feature mini stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {features.map((f) => (
          <div key={f.label} className="bg-gray-900 rounded-lg px-4 py-3 border border-gray-800 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${f.dotClass}`} />
              <span className="text-xs text-gray-400 truncate">{f.label}</span>
            </div>
            <div className="text-lg font-bold text-white">{f.users.toLocaleString()}</div>
            <div className="text-xs text-gray-500">
              {f.total.toLocaleString()} requests &middot; {f.pct}% done
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
