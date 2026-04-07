import React, { useEffect, useMemo, useState } from 'react'
import {
  Rocket, Bot, CheckCircle, XCircle, Square, AlertCircle, Loader2, Search
} from 'lucide-react'
import { useProfileStore } from '../../stores/profileStore'
import type { AutomationRunResult, AutomationWorkflow } from '../../types'

/**
 * Bulk Execute — fan a single workflow out to N selected profiles in parallel.
 *
 * Wraps `workflows.runParallel` with a focused UI: workflow picker, profile
 * checklist with search, concurrency slider, optional run-time variable
 * overrides, and a per-profile result grid.
 */
export function BulkExecuteTab() {
  const { profiles, activeSessions } = useProfileStore()
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('')
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set())
  const [concurrency, setConcurrency] = useState(3)
  const [search, setSearch] = useState('')
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<AutomationRunResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.workflows.list()
      .then(setWorkflows)
      .catch((e: any) => setError(e?.message ?? 'Failed to load workflows'))
  }, [])

  const selectedWorkflow = useMemo(
    () => workflows.find((w) => w.id === selectedWorkflowId) ?? null,
    [workflows, selectedWorkflowId]
  )

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? profiles.filter((p) => p.name.toLowerCase().includes(q)) : profiles
  }, [profiles, search])

  // Reset overrides when switching workflows
  useEffect(() => {
    setOverrides({})
    setResults(null)
  }, [selectedWorkflowId])

  const toggleProfile = (id: string) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedProfileIds(new Set(filteredProfiles.map((p) => p.id)))
  }

  const selectNoneActive = () => {
    setSelectedProfileIds(new Set(filteredProfiles.filter((p) => activeSessions.includes(p.id)).map((p) => p.id)))
  }

  const clearAll = () => setSelectedProfileIds(new Set())

  const handleRun = async () => {
    if (!selectedWorkflowId || selectedProfileIds.size === 0) return
    setError(null)
    setRunning(true)
    setResults(null)
    try {
      const runtimeVars: Record<string, string> = {}
      for (const [k, v] of Object.entries(overrides)) {
        if (v !== '') runtimeVars[k] = v
      }
      const vars = Object.keys(runtimeVars).length > 0 ? runtimeVars : undefined
      const data = await window.api.workflows.runParallel(
        selectedWorkflowId,
        Array.from(selectedProfileIds),
        vars,
        concurrency
      )
      setResults(data)
    } catch (e: any) {
      setError(e?.message ?? 'Bulk run failed')
    } finally {
      setRunning(false)
    }
  }

  const handleStopAll = () => {
    if (!selectedWorkflowId) return
    window.api.workflows.stopAll(selectedWorkflowId)
    setRunning(false)
  }

  const completedCount = results?.filter((r) => r.status === 'completed').length ?? 0
  const failedCount = results?.filter((r) => r.status === 'failed').length ?? 0
  const stoppedCount = results?.filter((r) => r.status === 'stopped').length ?? 0

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Rocket className="w-4 h-4 text-ghost-400" />
        <h2 className="text-sm font-medium text-white">Bulk Execute</h2>
        <span className="text-xs text-slate-500">Run one workflow on many profiles in parallel</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Left: workflow picker + run controls */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Workflow</label>
            <select
              value={selectedWorkflowId}
              onChange={(e) => setSelectedWorkflowId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Select a workflow…</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.steps.length} steps)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Concurrency: <span className="text-white">{concurrency}</span>
            </label>
            <input
              type="range"
              min={1}
              max={20}
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
              className="w-full accent-ghost-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
              <span>1</span><span>10</span><span>20</span>
            </div>
          </div>

          {selectedWorkflow && Object.keys(selectedWorkflow.variables ?? {}).length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Variable overrides</label>
              <div className="space-y-1.5">
                {Object.entries(selectedWorkflow.variables ?? {}).map(([k, defaultVal]) => (
                  <div key={k} className="flex items-center gap-2">
                    <code className="w-24 text-[11px] text-slate-300 font-mono truncate" title={k}>{k}</code>
                    <input
                      value={overrides[k] ?? ''}
                      onChange={(e) => setOverrides((p) => ({ ...p, [k]: e.target.value }))}
                      placeholder={defaultVal || '(empty)'}
                      className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-slate-500 px-2 py-2 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <div><span className="text-white font-medium">{selectedProfileIds.size}</span> profiles selected</div>
            <div className="text-slate-600 mt-0.5">
              {Array.from(selectedProfileIds).filter((id) => activeSessions.includes(id)).length} already active
            </div>
          </div>

          {running ? (
            <button
              onClick={handleStopAll}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg"
            >
              <Square className="w-4 h-4" />
              Stop All
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={!selectedWorkflowId || selectedProfileIds.size === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-ghost-600 hover:bg-ghost-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg"
            >
              <Rocket className="w-4 h-4" />
              Run × {selectedProfileIds.size}
            </button>
          )}
        </div>

        {/* Right: profile picker + results */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter profiles..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500"
            />
            <button onClick={selectAll} className="text-xs text-ghost-400 hover:text-ghost-300 px-2">All</button>
            <button onClick={selectNoneActive} className="text-xs text-ghost-400 hover:text-ghost-300 px-2">Active</button>
            <button onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-300 px-2">Clear</button>
          </div>

          <div className="border border-slate-800 rounded-xl bg-slate-900/40 max-h-64 overflow-y-auto">
            {filteredProfiles.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No profiles found</div>
            ) : (
              filteredProfiles.map((p) => {
                const checked = selectedProfileIds.has(p.id)
                const active = activeSessions.includes(p.id)
                return (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm border-b border-slate-800/40 last:border-0 hover:bg-slate-800/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProfile(p.id)}
                      className="accent-ghost-500"
                    />
                    <Bot className="w-3.5 h-3.5 text-slate-500" />
                    <span className="flex-1 text-slate-300 truncate">{p.name}</span>
                    {active && <span className="text-[10px] uppercase text-green-400">running</span>}
                  </label>
                )
              })
            )}
          </div>

          {/* Results */}
          {(running || results) && (
            <div className="border border-slate-700/60 bg-slate-800/40 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                {running && <Loader2 className="w-4 h-4 text-ghost-400 animate-spin" />}
                <span className="text-sm font-medium text-white">
                  {running ? 'Running…' : 'Results'}
                </span>
                {results && (
                  <span className="text-xs text-slate-500">
                    {completedCount} ok · {failedCount} failed · {stoppedCount} stopped
                  </span>
                )}
              </div>
              {results && (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {results.map((r) => {
                    const profile = profiles.find((p) => p.id === r.profileId)
                    return (
                      <div key={r.profileId} className="flex items-center gap-2 text-xs">
                        {r.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-400" />}
                        {r.status === 'failed'    && <XCircle className="w-3 h-3 text-red-400" />}
                        {r.status === 'stopped'   && <Square className="w-3 h-3 text-yellow-400" />}
                        <span className="text-slate-300 flex-1 truncate">{profile?.name ?? r.profileId}</span>
                        <span className="text-slate-500">{r.stepResults.length} steps</span>
                        {r.error && <span className="text-red-400 truncate max-w-[180px]">{r.error}</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
