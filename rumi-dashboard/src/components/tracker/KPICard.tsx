'use client'
import { calculateRAG, RAG_COLORS } from '@/lib/utils/rag'

interface Props {
  label:   string
  value:   number | string | null
  target?: number
  sub?:    string
  unit?:   string
}

export default function KPICard({ label, value, target, sub, unit = '' }: Props) {
  const numeric = typeof value === 'number' ? value : null
  const rag     = (numeric !== null && target) ? calculateRAG(numeric, target) : null
  const colors  = rag ? RAG_COLORS[rag] : null

  return (
    <div className={`rounded-xl p-5 border ${colors ? `${colors.bg} ${colors.border}` : 'bg-gray-900 border-gray-800'}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        {rag && colors && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
            {rag.toUpperCase()}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-white mt-2">
        {value ?? '—'}{unit}
      </p>
      {target && (
        <p className="text-xs text-gray-500 mt-1">Target: {target}{unit}</p>
      )}
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}
