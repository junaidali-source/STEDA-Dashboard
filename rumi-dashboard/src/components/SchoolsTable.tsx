const COUNTRY_LABELS: Record<string, string> = {
  '92': '🇵🇰 Pakistan',
  '94': '🇱🇰 Sri Lanka',
  '96': '🇲🇲 Myanmar',
}

interface SchoolRow {
  school_name: string
  teachers: number
  registered: number
  country_code: string
  lesson_plans: number
  coaching: number
  reading: number
}

export default function SchoolsTable({ data }: { data: SchoolRow[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-base font-semibold text-gray-700 mb-4">Top Schools / Partners</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
              <th className="pb-2 pr-4">School / Partner</th>
              <th className="pb-2 pr-4">Country</th>
              <th className="pb-2 pr-4 text-right">Teachers</th>
              <th className="pb-2 pr-4 text-right">Registered</th>
              <th className="pb-2 pr-4 text-right">Lessons</th>
              <th className="pb-2 pr-4 text-right">Coaching</th>
              <th className="pb-2 text-right">Reading</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2.5 pr-4 font-medium text-gray-800 max-w-xs truncate">
                  {row.school_name}
                </td>
                <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                  {COUNTRY_LABELS[row.country_code] || row.country_code}
                </td>
                <td className="py-2.5 pr-4 text-right font-semibold">{row.teachers.toLocaleString()}</td>
                <td className="py-2.5 pr-4 text-right text-green-600">{row.registered.toLocaleString()}</td>
                <td className="py-2.5 pr-4 text-right text-indigo-600">{row.lesson_plans.toLocaleString()}</td>
                <td className="py-2.5 pr-4 text-right text-orange-500">{row.coaching.toLocaleString()}</td>
                <td className="py-2.5 text-right text-rose-500">{row.reading.toLocaleString()}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">No data found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
