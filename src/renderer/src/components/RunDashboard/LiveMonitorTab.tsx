import React, { useEffect, useRef, useState } from 'react'
import {
  Activity, Loader2, CheckCircle, XCircle, Square, RefreshCw, Bot
} from 'lucide-react'
import { useProfileStore } from '../../stores/profileStore'

interface ActiveRun {
  workflowId: string
  workflowName: string
  profileId: string
  profileName: string
  steps: { stepId: string; action: string; success: boolean; duration_ms: number; error?: string }[]
  startedAt: number
}

const POLL_MS = 3000

/**
 * Live monitor — discovers active workflow runs by combining:
 *   - all loaded workflows × all active sessions → ask `isRunning` for each pair
 *   - subscribe to step-progress events to populate per-run live step list
 *
 * The UI updates in real time as steps come in, and refreshes the active-run
 * matrix every POLL_MS to catch newly-started or finished runs.
 */
export function LiveMonitorTab() {
  const { profiles, activeSessions } = useProfileStore()
  const [workflows, setWorkflows] = useState<{ id: string; name: string }[]>([])
  const [activeRuns, setActiveRuns] = useState<Map<string, ActiveRun>>(new Map())
  const [loading, setLoading] = useState(false)
  const stepsRef = useRef<Map<string, ActiveRun['steps']>>(new Map())

  const keyFor = (wfId: string, profileId: string) => `${wfId}::${profileId}`

  const fetchWorkflows = async () => {
    try {
      const ws = await window.api.workflows.list()
      setWorkflows(ws.map((w: any) => ({ id: w.id, name: w.name })))
    } catch { /* ignore */ }
  }

  const probeActiveRuns = async () => {
    if (workflows.length === 0 || activeSessions.length === 0) {
      setActiveRuns(new Map())
      return
    }
    setLoading(true)
    try {
      const next = new Map<string, ActiveRun>()
      for (const w of workflows) {
        for (const profileId of activeSessions) {
          try {
            const running = await window.api.workflows.isRunning(w.id, profileId)
            if (running) {
              const profile = profiles.find((p) => p.id === profileId)
              const k = keyFor(w.id, profileId)
              next.set(k, {
                workflowId: w.id,
                workflowName: w.name,
                profileId,
                profileName: profile?.name ?? profileId,
                steps: stepsRef.current.get(k) ?? [],
                startedAt: Date.now()
              })
            } else {
              // Run finished — clear its captured steps
              stepsRef.current.delete(keyFor(w.id, profileId))
            }
          } catch { /* ignore */ }
        }
      }
      setActiveRuns(next)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchWorkflows() }, [])

  // Subscribe to live step progress for ALL workflows
  useEffect(() => {
    const unsub = window.api.automation.onStepProgress(({ workflowId, profileId, step }) => {
      const k = keyFor(workflowId, profileId)
      const existing = stepsRef.current.get(k) ?? []
      // Replace if this stepId already exists (retry), otherwise append
      const idx = existing.findIndex((s) => s.stepId === step.stepId)
      const next = idx >= 0
        ? existing.map((s, i) => (i === idx ? step : s))
        : [...existing, step]
      stepsRef.current.set(k, next)
      // Update React state for any active run
      setActiveRuns((prev) => {
        const m = new Map(prev)
        const ar = m.get(k)
        if (ar) m.set(k, { ...ar, steps: next })
        return m
      })
    })
    return unsub
  }, [])

  // Poll active runs periodically
  useEffect(() => {
    probeActiveRuns()
    const id = setInterval(probeActiveRuns, POLL_MS)
    return () => clearInterval(id)
  }, [workflows.length, activeSessions.length])

  const handleStop = async (run: ActiveRun) => {
    try {
      await window.api.workflows.stop(run.workflowId, run.profileId)
      setTimeout(probeActiveRuns, 500)
    } catch { /* ignore */ }
  }

  const runs = Array.from(activeRuns.values())

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-ghost-400" />
          <h2 className="text-sm font-medium text-white">
            {runs.length} active run{runs.length !== 1 ? 's' : ''}
          </h2>
        </div>
        <span className="text-xs text-slate-500">
          polling every {POLL_MS / 1000}s · {activeSessions.length} active profile{activeSessions.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={probeActiveRuns}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {runs.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center">
          <Bot className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No active runs</p>
          <p className="text-slate-600 text-xs mt-1">
            Start a workflow from <span className="text-slate-400">Automation Builder</span> or the <span className="text-slate-400">Bulk Execute</span> tab.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {runs.map((run) => (
            <div key={`${run.workflowId}-${run.profileId}`} className="bg-slate-800/40 border border-ghost-500/30 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-ghost-400 animate-spin" />
                    <span className="text-sm font-medium text-white truncate">{run.workflowName}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">on {run.profileName}</div>
                </div>
                <button
                  onClick={() => handleStop(run)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded border border-red-500/30"
                >
                  <Square className="w-3 h-3" />
                  Stop
                </button>
              </div>

              <div className="text-[10px] text-slate-600 mb-2">
                {run.steps.length} step{run.steps.length !== 1 ? 's' : ''} executed
              </div>

              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {run.steps.length === 0 ? (
                  <div className="text-xs text-slate-600 italic">Waiting for first step…</div>
                ) : (
                  run.steps.slice(-20).map((s, i) => (
                    <div key={`${s.stepId}-${i}`} className="flex items-center gap-2 text-[11px]">
                      {s.success
                        ? <CheckCircle className="w-2.5 h-2.5 text-green-400 shrink-0" />
                        : <XCircle className="w-2.5 h-2.5 text-red-400 shrink-0" />
                      }
                      <span className="text-slate-400 w-24 truncate">{s.action}</span>
                      <span className="text-slate-600 w-12">{s.duration_ms}ms</span>
                      {s.error && <span className="text-red-400 truncate flex-1">{s.error}</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
