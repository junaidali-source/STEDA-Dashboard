'use client'

interface Milestone {
  id: string; title: string; phase: string
  start_date: string; end_date: string; status: string
  description: string; success_metric: string; actual_result: string
}

const STATUS_CONFIG = {
  done:        { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Done'        },
  in_progress: { dot: 'bg-blue-400',    text: 'text-blue-400',    label: 'In Progress' },
  at_risk:     { dot: 'bg-red-400',     text: 'text-red-400',     label: 'At Risk'     },
  upcoming:    { dot: 'bg-gray-600',    text: 'text-gray-500',    label: 'Upcoming'    },
}

export default function PlanTimeline({ milestones }: { milestones: Milestone[] }) {
  return (
    <div className="space-y-0">
      {milestones.map((m, i) => {
        const cfg = STATUS_CONFIG[m.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.upcoming
        return (
          <div key={m.id} className="flex gap-4">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
              {i < milestones.length - 1 && <div className="w-px flex-1 bg-gray-800 my-1" />}
            </div>
            {/* Content */}
            <div className={`pb-6 flex-1 ${i < milestones.length - 1 ? '' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">{m.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                  <p className="text-xs text-gray-600 mt-0.5">{m.end_date}</p>
                </div>
              </div>
              {(m.actual_result || m.success_metric) && (
                <p className="text-xs text-gray-500 mt-1 italic">
                  {m.actual_result || m.success_metric}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
