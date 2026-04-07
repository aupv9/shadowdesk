import React, { useEffect, useMemo, useState } from 'react'
import {
  Calendar, Plus, Trash2, Play, ToggleLeft, ToggleRight, AlertCircle, Clock,
  RefreshCw
} from 'lucide-react'
import { useProfileStore } from '../../stores/profileStore'
import type { AutomationWorkflow, WorkflowSchedule } from '../../types'

const CRON_PRESETS = [
  { label: 'Every 15 min',     value: '*/15 * * * *' },
  { label: 'Hourly',           value: '0 * * * *' },
  { label: 'Every 6h',         value: '0 */6 * * *' },
  { label: 'Daily 9 AM',       value: '0 9 * * *' },
  { label: 'Daily midnight',   value: '0 0 * * *' },
  { label: 'Weekdays 9 AM',    value: '0 9 * * 1-5' },
  { label: 'Weekly (Mon 9AM)', value: '0 9 * * 1' }
]

/**
 * Global Schedules — view, create, toggle, run, delete schedules across ALL
 * workflows. Re-uses the existing schedules:* IPC API. Per-workflow schedule
 * management still lives in `SchedulesModal`; this tab is the cross-workflow
 * dashboard counterpart.
 */
export function SchedulesTab() {
  const { profiles } = useProfileStore()
  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([])
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [workflowFilter, setWorkflowFilter] = useState('')

  // Create form state
  const [name, setName] = useState('Schedule')
  const [cron, setCron] = useState('0 9 * * *')
  const [createWorkflowId, setCreateWorkflowId] = useState('')
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set())

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, w] = await Promise.all([
        window.api.workflows.schedules.list(),
        window.api.workflows.list()
      ])
      setSchedules(s || [])
      setWorkflows(w || [])
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const workflowName = (id: string) =>
    workflows.find((w) => w.id === id)?.name ?? id.slice(0, 8)

  const profileName = (id: string) =>
    profiles.find((p) => p.id === id)?.name ?? id.slice(0, 6)

  const filteredSchedules = useMemo(() => {
    if (!workflowFilter) return schedules
    return schedules.filter((s) => s.workflow_id === workflowFilter)
  }, [schedules, workflowFilter])

  const handleCreate = async () => {
    if (!createWorkflowId) { setError('Select a workflow'); return }
    if (!cron.trim())      { setError('Cron expression required'); return }
    if (selectedProfileIds.size === 0) { setError('Select at least one profile'); return }
    setError(null)
    try {
      await window.api.workflows.schedules.create({
        workflow_id: createWorkflowId,
        profile_ids: Array.from(selectedProfileIds),
        cron: cron.trim(),
        enabled: true,
        name: name.trim() || 'Schedule'
      })
      setShowCreate(false)
      setName('Schedule')
      setCron('0 9 * * *')
      setCreateWorkflowId('')
      setSelectedProfileIds(new Set())
      await fetchAll()
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create schedule')
    }
  }

  const handleToggle = async (s: WorkflowSchedule) => {
    try {
      await window.api.workflows.schedules.update(s.id, { enabled: !s.enabled })
      await fetchAll()
    } catch (e: any) {
      setError(e?.message ?? 'Failed to toggle schedule')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this schedule?')) return
    try {
      await window.api.workflows.schedules.delete(id)
      await fetchAll()
    } catch (e: any) {
      setError(e?.message ?? 'Failed to delete schedule')
    }
  }

  const handleRunNow = async (id: string) => {
    try {
      await window.api.workflows.schedules.runNow(id)
      await fetchAll()
    } catch (e: any) {
      setError(e?.message ?? 'Failed to trigger schedule')
    }
  }

  const toggleProfile = (id: string) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Calendar className="w-4 h-4 text-ghost-400" />
        <h2 className="text-sm font-medium text-white">Schedules</h2>
        <span className="text-xs text-slate-500">
          {filteredSchedules.length} of {schedules.length}
        </span>
        <select
          value={workflowFilter}
          onChange={(e) => setWorkflowFilter(e.target.value)}
          className="ml-auto bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 max-w-[220px]"
        >
          <option value="">All workflows</option>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <button
          onClick={fetchAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-ghost-600 hover:bg-ghost-700 text-white rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="border border-slate-700 rounded-xl p-4 bg-slate-900/40 space-y-3">
          <h3 className="text-sm font-medium text-white">New schedule</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Workflow</label>
              <select
                value={createWorkflowId}
                onChange={(e) => setCreateWorkflowId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
              >
                <option value="">Select…</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Cron expression</label>
            <input
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {CRON_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setCron(p.value)}
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    cron === p.value
                      ? 'bg-ghost-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Profiles ({selectedProfileIds.size} selected)
            </label>
            <div className="max-h-40 overflow-y-auto border border-slate-700 rounded p-2 bg-slate-900/50">
              {profiles.length === 0 ? (
                <div className="text-xs text-slate-500 p-2">No profiles available</div>
              ) : (
                profiles.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-slate-300 hover:bg-slate-800 rounded px-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProfileIds.has(p.id)}
                      onChange={() => toggleProfile(p.id)}
                      className="accent-ghost-500"
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-ghost-600 hover:bg-ghost-700 text-white rounded-lg"
            >
              <Plus className="w-3 h-3" />
              Create
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading && schedules.length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-8">Loading…</div>
      ) : filteredSchedules.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center">
          <Clock className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No schedules</p>
          <p className="text-slate-600 text-xs mt-1">Create one above to run workflows on a cron-like schedule.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSchedules.map((s) => (
            <div key={s.id} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white truncate">{s.name}</span>
                    <code className="text-[11px] text-ghost-300 bg-slate-900 px-1.5 py-0.5 rounded">{s.cron}</code>
                    <span className="text-[10px] text-slate-600">→</span>
                    <span className="text-xs text-slate-400 truncate">{workflowName(s.workflow_id)}</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {s.profile_ids.length} profile{s.profile_ids.length !== 1 ? 's' : ''}: {s.profile_ids.map(profileName).join(', ')}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-3">
                    {s.last_run_at && <span>Last: {new Date(s.last_run_at).toLocaleString()}</span>}
                    {s.next_run_at && <span>Next: {new Date(s.next_run_at).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(s)}
                    title={s.enabled ? 'Disable' : 'Enable'}
                    className={`p-1.5 rounded-lg transition-colors ${s.enabled ? 'text-green-400 hover:bg-green-600/10' : 'text-slate-500 hover:bg-slate-700'}`}
                  >
                    {s.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleRunNow(s.id)}
                    title="Run now"
                    className="p-1.5 rounded-lg text-ghost-400 hover:bg-ghost-600/10"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    title="Delete"
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-600/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
