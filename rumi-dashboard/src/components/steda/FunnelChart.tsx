'use client'

interface Props {
  totalListed:     number
  totalJoined:     number
  anyFeatureUsers: number
}

const STAGES = [
  { key: 'listed',    label: 'Teachers Listed by STEDA',   barClass: 'bg-blue-500'  },
  { key: 'joined',    label: 'Joined Rumi (Phone Matched)', barClass: 'bg-teal-500'  },
  { key: 'activated', label: 'Used Any Rumi Feature',       barClass: 'bg-amber-400' },
]

export default function FunnelChart({ totalListed, totalJoined, anyFeatureUsers }: Props) {
  const values = [totalListed, totalJoined, anyFeatureUsers]

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 h-full">
      <h3 className="text-white font-semibold text-sm mb-6">Teacher Onboarding Funnel</h3>
      <div className="space-y-3">
        {STAGES.map((stage, i) => {
          const val      = values[i]
          const pct      = totalListed > 0 ? Math.round(val / totalListed * 100) : 0
          const widthPct = totalListed > 0 ? Math.max(val / totalListed * 100, 8) : 8

          return (
            <div key={stage.key} className="relative">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-400">{stage.label}</span>
                <span className="text-xs font-bold text-gray-300">{pct}%</span>
              </div>
              <div className="relative h-12 bg-gray-800 rounded-lg overflow-hidden">
                <div
                  className={`h-full rounded-lg flex items-center justify-center transition-all duration-700 ${stage.barClass}`}
                  style={{ width: `${widthPct}%` }}
                >
                  <span className="text-white font-bold text-base">{val.toLocaleString()}</span>
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div className="flex justify-center mt-1">
                  <span className="text-gray-600 text-lg">&#8595;</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
