'use client'
import { useState } from 'react'

interface Action {
  id: string; text: string; owner: string; due_date: string
  priority: string; status: string; category: string
  meeting_title?: string; meeting_date?: string
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   'text-red-400 bg-red-900/30 border-red-800',
  medium: 'text-amber-400 bg-amber-900/30 border-amber-800',
  low:    'text-emerald-400 bg-emerald-900/30 border-emerald-800',
}
const STATUS_COLORS: Record<string, string> = {
  open:    'text-blue-400',
  done:    'text-emerald-400',
  blocked: 'text-red-400',
}

export default function ActionTable({ actions: initial }: { actions: Action[] }) {
  const [actions, setActions] = useState(initial)
  const [filter, setFilter]   = useState({ status: '', owner: '', priority: '' })

  const today = new Date().toISOString().slice(0, 10)

  const filtered = actions.filter(a =>
    (!filter.status   || a.status === filter.status) &&
    (!filter.owner    || a.owner?.toLowerCase().includes(filter.owner.toLowerCase())) &&
    (!filter.priority || a.priority === filter.priority)
  )

  async function toggleStatus(id: string, current: string) {
    const next = current === 'open' ? 'done' : 'open'
    setActions(prev => prev.map(a => a.id === id ? { ...a, status: next } : a))
    await fetch('/api/tracker/actions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: next }) })
  }

  const owners = [...new Set(actions.map(a => a.owner).filter(Boolean))]

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))} title="Filter by status"
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 outline-none">
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="done">Done</option>
          <option value="blocked">Blocked</option>
        </select>
        <select value={filter.priority} onChange={e => setFilter(f => ({ ...f, priority: e.target.value }))} title="Filter by priority"
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 outline-none">
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filter.owner} onChange={e => setFilter(f => ({ ...f, owner: e.target.value }))} title="Filter by owner"
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 outline-none">
          <option value="">All Owners</option>
          {owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="ml-auto text-xs text-gray-500 self-center">
          {filtered.filter(a=>a.status==='open').length} open · {filtered.filter(a=>a.status==='done').length} done
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Meeting</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-500">No actions found</td></tr>
            ) : filtered.map((a, i) => {
              const overdue = a.status === 'open' && a.due_date && a.due_date < today
              return (
                <tr key={a.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${overdue ? 'bg-red-900/10' : i%2===1 ? 'bg-gray-900/30' : ''}`}>
                  <td className="px-4 py-3 text-gray-200 max-w-xs">
                    {overdue && <span className="text-red-400 mr-1">⚠</span>}
                    {a.text}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{a.owner || '—'}</td>
                  <td className={`px-4 py-3 whitespace-nowrap ${overdue ? 'text-red-400' : 'text-gray-400'}`}>{a.due_date || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${PRIORITY_COLORS[a.priority] ?? 'text-gray-400'}`}>
                      {a.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{a.meeting_title || '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleStatus(a.id, a.status)}
                      className={`text-xs font-medium hover:underline ${STATUS_COLORS[a.status] ?? 'text-gray-400'}`}>
                      {a.status}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
