interface DiscRow {
  suggested_feature: string
  shown: number
  clicked: number
  converted: number
  click_rate: number
  convert_rate: number
}

function RateBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className="bg-indigo-500 h-2 rounded-full"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 w-10 text-right">{value}%</span>
    </div>
  )
}

export default function DiscoverabilityPanel({ data }: { data: DiscRow[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-base font-semibold text-gray-700 mb-4">Feature Discoverability</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
              <th className="pb-2 pr-4">Suggested Feature</th>
              <th className="pb-2 pr-4 text-right">Shown</th>
              <th className="pb-2 pr-4 text-right">Clicked</th>
              <th className="pb-2 pr-4 text-right">Converted</th>
              <th className="pb-2 pr-4">Click Rate</th>
              <th className="pb-2">Convert Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2.5 pr-4 font-medium text-gray-800">{row.suggested_feature}</td>
                <td className="py-2.5 pr-4 text-right">{row.shown.toLocaleString()}</td>
                <td className="py-2.5 pr-4 text-right text-indigo-600">{row.clicked.toLocaleString()}</td>
                <td className="py-2.5 pr-4 text-right text-green-600">{row.converted.toLocaleString()}</td>
                <td className="py-2.5 pr-4 w-36"><RateBar value={row.click_rate ?? 0} /></td>
                <td className="py-2.5 w-36"><RateBar value={row.convert_rate ?? 0} /></td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">No data found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
