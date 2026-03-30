'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function IngestButton() {
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<string | null>(null)
  const router = useRouter()

  async function handleIngest() {
    setLoading(true)
    setResult(null)
    try {
      const res  = await fetch('/api/tracker/ingest', { method: 'POST' })
      const data = await res.json()
      if (data.error) { setResult(`Error: ${data.error}`); return }
      setResult(data.ingested === 0 ? 'No new meetings found.' : `Ingested ${data.ingested} new meeting(s).`)
      router.refresh()
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleIngest} disabled={loading}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors">
        <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {loading ? 'Pulling from Gmail…' : 'Pull from Gmail'}
      </button>
      {result && <span className="text-xs text-gray-400">{result}</span>}
    </div>
  )
}
