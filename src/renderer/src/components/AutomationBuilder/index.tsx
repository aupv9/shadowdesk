import React, { useEffect, useState } from 'react'
import {
  Play,
  Plus,
  Trash2,
  Square,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bot,
  GripVertical,
  Copy
} from 'lucide-react'
import { useAutomationStore } from '../../stores/automationStore'
import { useProfileStore } from '../../stores/profileStore'
import { StepEditor } from './StepEditor'
import { WorkflowCreateModal } from './WorkflowCreateModal'
import type { AutomationWorkflow, AutomationStep, AutomationActionType } from '../../types'

export function AutomationBuilder() {
  const {
    workflows, selectedWorkflow, runResult, runHistory,
    loading, running, error,
    fetchWorkflows, selectWorkflow, createWorkflow, updateWorkflow, deleteWorkflow,
    runWorkflow, stopWorkflow, clearError
  } = useAutomationStore()

  const { profiles, activeSessions } = useProfileStore()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')

  useEffect(() => {
    fetchWorkflows()
  }, [])

  useEffect(() => {
    if (activeSessions.length > 0 && !selectedProfileId) {
      setSelectedProfileId(activeSessions[0])
    }
  }, [activeSessions])

  const handleAddStep = () => {
    if (!selectedWorkflow) return
    const newStep: AutomationStep = {
      id: crypto.randomUUID(),
      action: 'navigate',
      label: 'New Step',
      params: { url: 'https://example.com' }
    }
    updateWorkflow(selectedWorkflow.id, {
      steps: [...selectedWorkflow.steps, newStep]
    })
  }

  const handleUpdateStep = (stepId: string, updates: Partial<AutomationStep>) => {
    if (!selectedWorkflow) return
    const steps = selectedWorkflow.steps.map((s) =>
      s.id === stepId ? { ...s, ...updates } : s
    )
    updateWorkflow(selectedWorkflow.id, { steps })
  }

  const handleDeleteStep = (stepId: string) => {
    if (!selectedWorkflow) return
    updateWorkflow(selectedWorkflow.id, {
      steps: selectedWorkflow.steps.filter((s) => s.id !== stepId)
    })
  }

  const handleDuplicateStep = (stepId: string) => {
    if (!selectedWorkflow) return
    const step = selectedWorkflow.steps.find((s) => s.id === stepId)
    if (!step) return
    const idx = selectedWorkflow.steps.indexOf(step)
    const newStep = { ...step, id: crypto.randomUUID(), label: `${step.label || step.action} (copy)` }
    const steps = [...selectedWorkflow.steps]
    steps.splice(idx + 1, 0, newStep)
    updateWorkflow(selectedWorkflow.id, { steps })
  }

  const handleMoveStep = (stepId: string, direction: 'up' | 'down') => {
    if (!selectedWorkflow) return
    const steps = [...selectedWorkflow.steps]
    const idx = steps.findIndex((s) => s.id === stepId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= steps.length) return
    ;[steps[idx], steps[swapIdx]] = [steps[swapIdx], steps[idx]]
    updateWorkflow(selectedWorkflow.id, { steps })
  }

  const handleRun = async () => {
    if (!selectedWorkflow || !selectedProfileId) return
    try {
      await runWorkflow(selectedWorkflow.id, selectedProfileId)
    } catch { /* error is set in store */ }
  }

  const handleStop = () => {
    if (!selectedWorkflow || !selectedProfileId) return
    stopWorkflow(selectedWorkflow.id, selectedProfileId)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-ghost-400" />
          <h1 className="text-lg font-semibold text-white">Automation Builder</h1>
          <span className="text-xs text-slate-500">
            {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-2 bg-ghost-600 hover:bg-ghost-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-3 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-300">&times;</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Workflow list sidebar */}
        <div className="w-64 border-r border-slate-800 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-slate-500">Loading...</div>
          ) : workflows.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">
              No workflows yet. Create one to get started.
            </div>
          ) : (
            <div className="py-2">
              {workflows.map((w) => (
                <button
                  key={w.id}
                  onClick={() => selectWorkflow(w.id)}
                  className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${
                    selectedWorkflow?.id === w.id
                      ? 'bg-ghost-600/10 text-ghost-400 border-r-2 border-ghost-500'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Bot className="w-4 h-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{w.name}</div>
                    <div className="text-xs text-slate-500">{w.steps.length} steps</div>
                  </div>
                  <ChevronRight className="w-3 h-3 shrink-0 opacity-50" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {selectedWorkflow ? (
            <div className="p-6">
              {/* Workflow header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedWorkflow.name}</h2>
                  {selectedWorkflow.description && (
                    <p className="text-sm text-slate-400 mt-1">{selectedWorkflow.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => deleteWorkflow(selectedWorkflow.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Delete workflow"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Run controls */}
              <div className="flex items-center gap-3 mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="flex-1 bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ghost-500"
                >
                  <option value="">Select a profile...</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {activeSessions.includes(p.id) ? '(running)' : ''}
                    </option>
                  ))}
                </select>
                {running ? (
                  <button
                    onClick={handleStop}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={handleRun}
                    disabled={!selectedProfileId || !activeSessions.includes(selectedProfileId) || selectedWorkflow.steps.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Run
                  </button>
                )}
              </div>

              {/* Run result */}
              {runResult && (
                <div className={`mb-6 p-4 rounded-lg border ${
                  runResult.status === 'completed'
                    ? 'bg-green-500/5 border-green-500/20'
                    : runResult.status === 'failed'
                      ? 'bg-red-500/5 border-red-500/20'
                      : 'bg-yellow-500/5 border-yellow-500/20'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {runResult.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-400" />}
                    {runResult.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                    {runResult.status === 'stopped' && <Square className="w-4 h-4 text-yellow-400" />}
                    <span className="text-sm font-medium text-white capitalize">{runResult.status}</span>
                    <span className="text-xs text-slate-500">
                      {runResult.stepResults.length} step{runResult.stepResults.length !== 1 ? 's' : ''} executed
                    </span>
                  </div>
                  {runResult.error && (
                    <p className="text-sm text-red-400">{runResult.error}</p>
                  )}
                  <div className="mt-2 space-y-1">
                    {runResult.stepResults.map((sr) => (
                      <div key={sr.stepId} className="flex items-center gap-2 text-xs">
                        {sr.success
                          ? <CheckCircle className="w-3 h-3 text-green-400" />
                          : <XCircle className="w-3 h-3 text-red-400" />
                        }
                        <span className="text-slate-400">{sr.action}</span>
                        <span className="text-slate-600">{sr.duration_ms}ms</span>
                        {sr.error && <span className="text-red-400 truncate">{sr.error}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Steps */}
              <div className="space-y-3">
                {selectedWorkflow.steps.map((step, idx) => (
                  <StepEditor
                    key={step.id}
                    step={step}
                    index={idx}
                    total={selectedWorkflow.steps.length}
                    onUpdate={(updates) => handleUpdateStep(step.id, updates)}
                    onDelete={() => handleDeleteStep(step.id)}
                    onDuplicate={() => handleDuplicateStep(step.id)}
                    onMove={(dir) => handleMoveStep(step.id, dir)}
                  />
                ))}

                <button
                  onClick={handleAddStep}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-700 hover:border-ghost-500 text-slate-500 hover:text-ghost-400 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Step
                </button>
              </div>

              {/* Run History */}
              {runHistory.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Run History</h3>
                  <div className="space-y-2">
                    {runHistory.slice(0, 10).map((run: any) => (
                      <div
                        key={run.id}
                        className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-lg text-xs"
                      >
                        {run.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                        {run.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        {run.status === 'stopped' && <Square className="w-3.5 h-3.5 text-yellow-400" />}
                        <span className="text-slate-400 capitalize">{run.status}</span>
                        <span className="text-slate-600">{run.step_results.length} steps</span>
                        <Clock className="w-3 h-3 text-slate-600 ml-auto" />
                        <span className="text-slate-500">
                          {new Date(run.started_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Bot className="w-12 h-12 text-slate-700 mb-4" />
              <h2 className="text-lg font-medium text-slate-400 mb-2">Select or create a workflow</h2>
              <p className="text-sm text-slate-500 max-w-md">
                Build automation workflows to control browser profiles. Add steps like navigate, click,
                type, screenshot, and more — then run them on any active profile.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <WorkflowCreateModal
          onClose={() => setShowCreate(false)}
          onCreate={async (name, description) => {
            const w = await createWorkflow({ name, description, steps: [] })
            selectWorkflow(w.id)
            setShowCreate(false)
          }}
        />
      )}
    </div>
  )
}
