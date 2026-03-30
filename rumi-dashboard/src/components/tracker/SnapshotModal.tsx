'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const FIELDS = [
  { key: 'snapshot_date',    label: 'Snapshot Date',      type: 'date',   required: true },
  { key: 'teachers_listed',  label: 'Teachers Listed',     type: 'number' },
  { key: 'teachers_joined',  label: 'Teachers Joined',     type: 'number' },
  { key: 'joined_pct',       label: 'Joined %',            type: 'number' },
  { key: 'used_any_feature', label: 'Used Any Feature',    type: 'number' },
  { key: 'used_any_pct',     label: 'Used Any %',          type: 'number' },
  { key: 'total_requests',   label: 'Total Requests',      type: 'number' },
  { key: 'completion_pct',   label: 'Completion %',        type: 'number' },
  { key: 'lp_teachers',      label: 'LP Teachers',         type: 'number' },
  { key: 'lp_requests',      label: 'LP Requests',         type: 'number' },
  { key: 'lp_completion',    label: 'LP Completion %',     type: 'number' },
  { key: 'coaching_teachers',label: 'Coaching Teachers',   type: 'number' },
  { key: 'video_teachers',   label: 'Video Teachers',      type: 'number' },
  { key: 'video_completion', label: 'Video Completion %',  type: 'number' },
  { key: 'image_teachers',   label: 'Image Teachers',      type: 'number' },
  { key: 'community_members',label: 'Community Members',   type: 'number' },
]

export default function SnapshotModal() {
  const [open,    setOpen]    = useState(false)
  const [form,    setForm]    = useState<Record<string, string>>({})
  const [saving,  setSaving]  = useState(false)
  const router = useRouter()

  async function handleSave() {
    setSaving(true)
    const body: Record<string, unknown> = { source: 'manual' }
    for (const f of FIELDS) { if (form[f.key]) body[f.key] = f.type === 'number' ? parseFloat(form[f.key]) : form[f.key] }
    await fetch('/api/tracker/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    setOpen(false)
    setForm({})
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors">
        + Add Snapshot
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-white font-semibold">Add Metric Snapshot</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-lg">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-400 mb-1 block">{f.label}{f.required && ' *'}</label>
                  <input
                    type={f.type}
                    value={form[f.key] ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-white px-4 py-2">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.snapshot_date}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg">
                {saving ? 'Saving…' : 'Save Snapshot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
