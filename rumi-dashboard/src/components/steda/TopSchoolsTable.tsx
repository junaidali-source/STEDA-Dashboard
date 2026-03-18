'use client'

interface SchoolRow {
  school_name:     string
  teachers:        number
  lesson_plans:    number
  coaching:        number
  reading:         number
  video:           number
  image:           number
  features_active: number
}

interface Props { data: SchoolRow[] }

const FEATURE_COLS = [
  { key: 'lesson_plans', label: 'LP',      title: 'Lesson Plans',     dotClass: 'bg-blue-500'   },
  { key: 'coaching',     label: 'Coach',   title: 'Coaching',         dotClass: 'bg-amber-400'  },
  { key: 'reading',      label: 'Read',    title: 'Reading',          dotClass: 'bg-violet-500' },
  { key: 'video',        label: 'Video',   title: 'Video Generation', dotClass: 'bg-green-400'  },
  { key: 'image',        label: 'Image',   title: 'Image Analysis',   dotClass: 'bg-pink-500'   },
]

function FeatureDot({ count, dotClass }: { count: number; dotClass: string }) {
  if (count === 0) return <span className="w-2 h-2 rounded-full bg-gray-700 inline-block" />
  return <span className={`w-2 h-2 rounded-full inline-block ${dotClass}`} title={String(count)} />
}

export default function TopSchoolsTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center text-gray-500 text-sm">
        No school data available
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h3 className="text-white font-semibold text-sm mb-1">Top Schools by Engagement</h3>
      <p className="text-xs text-gray-500 mb-4">Ranked by number of active features · Top 20 schools</p>

      {/* Column legend */}
      <div className="flex gap-3 mb-3 flex-wrap">
        {FEATURE_COLS.map(f => (
          <span key={f.key} className="flex items-center gap-1 text-xs text-gray-400">
            <span className={`w-2 h-2 rounded-full ${f.dotClass}`} />
            {f.label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 pr-3 text-gray-400 font-medium">School</th>
              <th className="text-center py-2 px-2 text-gray-400 font-medium">Teachers</th>
              {FEATURE_COLS.map(f => (
                <th key={f.key} className="text-center py-2 px-2" title={f.title}>
                  <span className={`w-2 h-2 rounded-full inline-block ${f.dotClass}`} />
                </th>
              ))}
              <th className="text-center py-2 pl-2 text-gray-400 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-gray-800/50 ${i % 2 === 0 ? 'bg-gray-800/20' : ''}`}
              >
                <td className="py-2 pr-3 text-gray-200 max-w-[200px] truncate" title={row.school_name}>
                  {row.school_name}
                </td>
                <td className="py-2 px-2 text-center text-gray-300 font-semibold">
                  {row.teachers}
                </td>
                {FEATURE_COLS.map(f => (
                  <td key={f.key} className="py-2 px-2 text-center">
                    <FeatureDot
                      count={(row as unknown as Record<string, number>)[f.key] ?? 0}
                      dotClass={f.dotClass}
                    />
                  </td>
                ))}
                <td className="py-2 pl-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                    row.features_active >= 3
                      ? 'bg-teal-900 text-teal-300'
                      : row.features_active >= 2
                        ? 'bg-amber-900 text-amber-300'
                        : row.features_active === 1
                          ? 'bg-blue-900 text-blue-300'
                          : 'bg-gray-800 text-gray-500'
                  }`}>
                    {row.features_active}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
