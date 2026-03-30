export type RAGStatus = 'green' | 'amber' | 'red'

export function calculateRAG(actual: number, target: number): RAGStatus {
  const ratio = actual / target
  return ratio >= 0.9 ? 'green' : ratio >= 0.65 ? 'amber' : 'red'
}

export const RAG_COLORS: Record<RAGStatus, { bg: string; text: string; dot: string; border: string }> = {
  green: { bg: 'bg-emerald-900/30', text: 'text-emerald-400', dot: 'bg-emerald-400', border: 'border-emerald-800' },
  amber: { bg: 'bg-amber-900/30',   text: 'text-amber-400',   dot: 'bg-amber-400',   border: 'border-amber-800'   },
  red:   { bg: 'bg-red-900/30',     text: 'text-red-400',     dot: 'bg-red-400',     border: 'border-red-800'     },
}
