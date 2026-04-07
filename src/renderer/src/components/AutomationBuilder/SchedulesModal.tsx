import React, { useEffect, useState } from 'react'
import { X, Plus, Trash2, Play, Calendar, Clock, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react'
import type { AutomationWorkflow, Profile, WorkflowSchedule } from '../../types'

interface Props {
  workflow: AutomationWorkflow
  profiles: Profile[]
  onClose: () => void
}

const CRON_PRESETS = [
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every hour',       value: '0 * * * *' },
  { label: 'Every 6 hours',    value: '0 */6 * * *' },
  { label: 'Daily at 9 AM',    value: '0 9 * * *' },
  { label: 'Daily at midnight',value: '0 0 * * *' },
  { label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
  { label: 'Weekly (Mon 9AM)', value: '0 9 * * 1' }
]

export function SchedulesModal({ workflow, profiles, onClose }: Props) {
  const [schedules,  setSchedules]  = useState<WorkflowSchedule[]>([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Create form state
  const [name, setName]               = useState('Schedule')
  const [cron, setCron]               = useState('0 9 * * *')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      const all = await window.api.workflows.schedules.list()
      setSchedules(all.filter((s: WorkflowSchedule) => s.workflow_id === workflow.id))
    } catch (e: any) {
      setError(e.message ?? 'Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSchedules() }, [workflow.id])

  const handleCreate = async () => {
    if (!cron.trim()) { setError('Cron expression required'); return }
    if (selectedIds.size === 0) { setError('Select at least one profile'); return }
    setError(null)
    try {
      await window.api.workflows.schedules.create({
        workflow_id: workflow.id,
        profile_ids: Array.from(selectedIds),
        cron: cron.trim(),
        enabled: true,
        name: name.trim() || 'Schedule'
      })
      setShowCreate(false)
      setName('Schedule')
      setCron('0 9 * * *')
      setSelectedIds(new Set())
      await fetchSchedules()
    } catch (e: any) {
      setError(e.message ?? 'Failed to create schedule')
    }
  }

  const handleToggle = async (s: WorkflowSchedule) => {
    try {
      await window.api.workflows.schedules.update(s.id, { enabled: !s.enabled })
      await fetchSchedules()
    } catch (e: any) {
      setError(e.message ?? 'Failed to toggle schedule')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this schedule?')) return
    try {
      await window.api.workflows.schedules.delete(id)
      await fetchSchedules()
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete schedule')
    }
  }

  const handleRunNow = async (id: string) => {
    try {
      await window.api.workflows.schedules.runNow(id)
      await fetchSchedules()
    } catch (e: any) {
      setError(e.message ?? 'Failed to trigger schedule')
    }
  }

  const toggleProfile = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const profileNames = (ids: string[]) =>
    ids.map((id) => profiles.find((p) => p.id === id)?.name ?? id.slice(0, 6)).join(', ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-ghost-400" />
            <h2 className="text-base font-semibold text-white">Schedules — {workflow.name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}>&times;</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {/* Existing schedules */}
          {loading ? (
            <div className="text-center text-slate-500 text-sm py-6">Loading…</div>
          ) : schedules.length === 0 && !showCreate ? (
            <div className="text-center py-10">
              <Clock className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-medium text-sm">No schedules yet</p>
              <p className="text-slate-500 text-xs mt-1">Create one to run this workflow on a cron-like schedule.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {schedules.map((s) => (
                <div key={s.id} className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white truncate">{s.name}</span>
                        <code className="text-[11px] text-ghost-300 bg-slate-800 px-1.5 py-0.5 rounded">{s.cron}</code>
                      </div>
                      <div className="text-xs text-slate-500 truncate" title={profileNames(s.profile_ids)}>
                        {s.profile_ids.length} profile{s.profile_ids.length !== 1 ? 's' : ''} · {profileNames(s.profile_ids)}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-3">
                        {s.last_run_at && <span>Last: {new Date(s.last_run_at).toLocaleString()}</span>}
                        {s.next_run_at && <span>Next: {new Date(s.next_run_at).toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggle(s)}
                        title={s.enabled ? 'Disable schedule' : 'Enable schedule'}
                        className={`p-1.5 rounded-lg transition-colors ${s.enabled ? 'text-green-400 hover:bg-green-600/10' : 'text-slate-500 hover:bg-slate-700'}`}
                      >
                        {s.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleRunNow(s.id)}
                        title="Run now"
                        className="p-1.5 rounded-lg text-ghost-400 hover:bg-ghost-600/10 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        title="Delete"
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-600/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create schedule form */}
          {showCreate ? (
            <div className="border border-slate-700 rounded-xl p-4 bg-slate-900/30">
              <h3 className="text-sm font-medium text-white mb-3">New schedule</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Daily warmup"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Cron expression (5 fields)</label>
                  <input
                    className="input font-mono text-xs"
                    value={cron}
                    onChange={(e) => setCron(e.target.value)}
                    placeholder="0 9 * * *"
                  />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {CRON_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setCron(p.value)}
                        className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                          cron === p.value
                            ? 'bg-ghost-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Format: <code>min hour day-of-month month day-of-week</code> · supports <code>*</code>, lists, ranges, <code>*/n</code>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Profiles ({selectedIds.size} selected)
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-slate-700 rounded-lg p-2 bg-slate-900/50 space-y-1">
                    {profiles.length === 0 ? (
                      <div className="text-xs text-slate-500 p-2">No profiles available.</div>
                    ) : (
                      profiles.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm text-slate-300 hover:bg-slate-800 rounded px-2 py-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleProfile(p.id)}
                            className="accent-ghost-500"
                          />
                          <span className="flex-1 truncate">{p.name}</span>
                          <span className="text-[10px] text-slate-500">{p.fingerprint?.preset}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowCreate(false)} className="btn-secondary text-xs">Cancel</button>
                <button onClick={handleCreate} className="btn-primary text-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Create schedule
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-700 hover:border-ghost-500 text-slate-500 hover:text-ghost-400 rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              New schedule
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
