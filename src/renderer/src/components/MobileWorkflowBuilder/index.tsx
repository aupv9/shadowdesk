import React, { useEffect, useMemo, useState } from 'react'
import {
  Smartphone,
  Plus,
  Play,
  Trash2,
  Copy,
  Edit3,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Fingerprint,
  MapPin,
  Battery,
  Wifi,
  MousePointer,
  Hand,
  Maximize2,
  RotateCw,
  Zap,
  Move,
  Target,
  Users
} from 'lucide-react'
import { useMobileWorkflowStore } from '../../stores/mobileWorkflowStore'
import { useProfileStore } from '../../stores/profileStore'
import type { MobileWorkflow, MobileAutomationStep, MobileBehaviorArchetype } from '../../types'

// ── Action Palette ────────────────────────────────────────────────────────────

const GESTURE_ACTIONS = [
  { action: 'tapPoint', label: 'Tap Point', icon: MousePointer, color: 'text-blue-400' },
  { action: 'tapElement', label: 'Tap Element', icon: Target, color: 'text-blue-400' },
  { action: 'swipe', label: 'Swipe', icon: Move, color: 'text-green-400' },
  { action: 'longPress', label: 'Long Press', icon: Hand, color: 'text-amber-400' },
  { action: 'doubleTap', label: 'Double Tap', icon: Zap, color: 'text-purple-400' },
  { action: 'pinch', label: 'Pinch Zoom', icon: Maximize2, color: 'text-pink-400' },
  { action: 'dragDrop', label: 'Drag & Drop', icon: Move, color: 'text-cyan-400' }
] as const

const SENSOR_ACTIONS = [
  { action: 'setLocation', label: 'Set Location', icon: MapPin, color: 'text-red-400' },
  { action: 'setBattery', label: 'Set Battery', icon: Battery, color: 'text-green-400' },
  { action: 'setNetworkInfo', label: 'Set Network', icon: Wifi, color: 'text-blue-400' },
  { action: 'setAccelerometer', label: 'Accelerometer', icon: Smartphone, color: 'text-amber-400' },
  { action: 'setGyroscope', label: 'Gyroscope', icon: RotateCw, color: 'text-purple-400' }
] as const

const DEVICE_ACTIONS = [
  { action: 'rotateDevice', label: 'Rotate Device', icon: RotateCw, color: 'text-orange-400' },
  { action: 'setViewport', label: 'Set Viewport', icon: Maximize2, color: 'text-teal-400' }
] as const

const STANDARD_ACTIONS = [
  { action: 'navigate', label: 'Navigate', icon: ChevronRight, color: 'text-slate-400' },
  { action: 'wait', label: 'Wait', icon: Clock, color: 'text-slate-400' },
  { action: 'type', label: 'Type Text', icon: Edit3, color: 'text-slate-400' },
  { action: 'click', label: 'Click', icon: MousePointer, color: 'text-slate-400' },
  { action: 'scroll', label: 'Scroll', icon: Move, color: 'text-slate-400' }
] as const

// ── Default params for new steps ──────────────────────────────────────────────

function defaultParams(action: string): Record<string, any> {
  switch (action) {
    case 'tapPoint': return { x: 180, y: 400, jitterEnabled: true }
    case 'tapElement': return { selector: '' }
    case 'swipe': return { fromX: 180, fromY: 500, toX: 180, toY: 200, duration: 600, count: 1 }
    case 'longPress': return { x: 180, y: 300, duration: 800 }
    case 'doubleTap': return { x: 180, y: 300 }
    case 'pinch': return { centerX: 180, centerY: 400, scaleFactor: 2.0 }
    case 'dragDrop': return { fromX: 100, fromY: 300, toX: 250, toY: 500, duration: 500 }
    case 'setLocation': return { latitude: 10.8231, longitude: 106.6297, accuracy: 50 }
    case 'setBattery': return { level: 80, charging: false }
    case 'setNetworkInfo': return { type: '4g', downlink: 10, rtt: 50 }
    case 'setAccelerometer': return { x: 0, y: -9.8, z: 0 }
    case 'setGyroscope': return { alpha: 0, beta: 0, gamma: 0 }
    case 'rotateDevice': return { orientation: 'portrait' }
    case 'setViewport': return { width: 375, height: 812, deviceScaleFactor: 3 }
    case 'navigate': return { url: 'https://example.com', waitUntil: 'networkidle2' }
    case 'wait': return { ms: 2000 }
    case 'type': return { selector: 'input', text: '', delay: 50 }
    case 'click': return { selector: 'button' }
    case 'scroll': return { y: 500 }
    default: return {}
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export function MobileWorkflowBuilder() {
  const store = useMobileWorkflowStore()
  const { profiles } = useProfileStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([])
  const [editingStep, setEditingStep] = useState<string | null>(null)
  const [tab, setTab] = useState<'editor' | 'logs'>('editor')

  useEffect(() => {
    store.fetchWorkflows()
    store.fetchArchetypes()
    store.fetchGestureTemplates()
  }, [])

  // Filter mobile-capable profiles (Android/iOS presets)
  const mobileProfiles = useMemo(() => {
    return profiles.filter((p) => {
      try {
        const fp = typeof p.fingerprint === 'string' ? JSON.parse(p.fingerprint) : p.fingerprint
        const os = fp?.os?.name?.toLowerCase() ?? ''
        return os.includes('android') || os.includes('ios') || os.includes('ipad')
      } catch {
        return false
      }
    })
  }, [profiles])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const wf = await store.createWorkflow({
      name: newName.trim(),
      description: '',
      steps: [],
      deviceConfig: { targetProfiles: [], executionMode: 'sequential', stopOnError: false }
    })
    store.selectWorkflow(wf.id)
    setNewName('')
    setShowCreate(false)
  }

  const handleAddStep = (action: string) => {
    const wf = store.selectedWorkflow
    if (!wf) return
    const step: MobileAutomationStep = {
      id: crypto.randomUUID(),
      action: action as any,
      label: action,
      params: defaultParams(action)
    }
    const newSteps = [...(wf.steps ?? []), step]
    store.updateWorkflow(wf.id, { steps: newSteps })
  }

  const handleRemoveStep = (stepId: string) => {
    const wf = store.selectedWorkflow
    if (!wf) return
    store.updateWorkflow(wf.id, { steps: wf.steps.filter((s) => s.id !== stepId) })
  }

  const handleUpdateStepParam = (stepId: string, key: string, value: any) => {
    const wf = store.selectedWorkflow
    if (!wf) return
    const newSteps = wf.steps.map((s) =>
      s.id === stepId ? { ...s, params: { ...s.params, [key]: value } } : s
    )
    store.updateWorkflow(wf.id, { steps: newSteps })
  }

  const handleUpdateStepLabel = (stepId: string, label: string) => {
    const wf = store.selectedWorkflow
    if (!wf) return
    const newSteps = wf.steps.map((s) => (s.id === stepId ? { ...s, label } : s))
    store.updateWorkflow(wf.id, { steps: newSteps })
  }

  const handleExecute = async () => {
    const wf = store.selectedWorkflow
    if (!wf || selectedProfileIds.length === 0) return
    try {
      await store.executeWorkflow(wf.id, selectedProfileIds)
    } catch {
      // error handled by store
    }
  }

  const handleSetBehavior = (patternId: string) => {
    const wf = store.selectedWorkflow
    if (!wf) return
    store.updateWorkflow(wf.id, { behaviorPattern: patternId || undefined })
  }

  const wf = store.selectedWorkflow

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-600/20 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Mobile Workflows</h1>
            <p className="text-xs text-slate-500">Phase 17 — Gesture automation, sensor simulation, behavior patterns</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setTab('editor')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'editor' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Editor
            </button>
            <button
              onClick={() => { setTab('logs'); store.fetchExecutionLogs(wf?.id) }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'logs' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Execution Logs
            </button>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Workflow
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-4">Create Mobile Workflow</h3>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Workflow name..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={!newName.trim()} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Workflow List */}
        <div className="w-64 border-r border-slate-800 overflow-y-auto p-3 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-2 py-1 font-semibold">Workflows ({store.workflows.length})</div>
          {store.workflows.map((w) => (
            <button
              key={w.id}
              onClick={() => store.selectWorkflow(w.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                wf?.id === w.id ? 'bg-purple-600/20 text-purple-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate flex-1">{w.name}</span>
              <span className="text-[10px] text-slate-600">{w.steps?.length ?? 0}s</span>
            </button>
          ))}
          {store.workflows.length === 0 && (
            <div className="text-xs text-slate-600 text-center py-8">No mobile workflows yet</div>
          )}
        </div>

        {tab === 'editor' ? (
          /* Center + Right: Editor */
          wf ? (
            <>
              {/* Center: Steps Editor */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Workflow Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-white">{wf.name}</h2>
                    <p className="text-xs text-slate-500">{wf.steps?.length ?? 0} steps {wf.behaviorPattern ? `- ${wf.behaviorPattern}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => store.duplicateWorkflow(wf.id)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { store.deleteWorkflow(wf.id) }}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Steps List */}
                <div className="space-y-2">
                  {(wf.steps ?? []).map((step, idx) => (
                    <div key={step.id} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-[10px] font-mono text-slate-400">{idx + 1}</span>
                          <span className="text-xs font-medium text-purple-400">{step.action}</span>
                          {editingStep === step.id ? (
                            <input
                              value={step.label}
                              onChange={(e) => handleUpdateStepLabel(step.id, e.target.value)}
                              onBlur={() => setEditingStep(null)}
                              onKeyDown={(e) => e.key === 'Enter' && setEditingStep(null)}
                              className="bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white w-40"
                              autoFocus
                            />
                          ) : (
                            <span
                              className="text-xs text-slate-300 cursor-pointer hover:text-white"
                              onClick={() => setEditingStep(step.id)}
                            >
                              {step.label}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveStep(step.id)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Inline Params Editor */}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {Object.entries(step.params).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-1.5">
                            <label className="text-[10px] text-slate-500 w-16 truncate">{key}</label>
                            {typeof val === 'boolean' ? (
                              <button
                                onClick={() => handleUpdateStepParam(step.id, key, !val)}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium ${val ? 'bg-green-600/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}
                              >
                                {val ? 'true' : 'false'}
                              </button>
                            ) : (
                              <input
                                value={String(val)}
                                onChange={(e) => {
                                  const num = Number(e.target.value)
                                  handleUpdateStepParam(step.id, key, isNaN(num) || e.target.value === '' ? e.target.value : num)
                                }}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-white"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {(wf.steps ?? []).length === 0 && (
                    <div className="text-center py-12 text-slate-600 text-xs">
                      Add steps from the action palette on the right
                    </div>
                  )}
                </div>

                {/* Execute Bar */}
                <div className="mt-4 bg-slate-800/80 border border-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-white mb-1">Execute Workflow</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {mobileProfiles.slice(0, 8).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSelectedProfileIds((prev) =>
                                prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                              )
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                              selectedProfileIds.includes(p.id)
                                ? 'bg-purple-600/20 text-purple-400 ring-1 ring-purple-500/30'
                                : 'bg-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                        {mobileProfiles.length === 0 && (
                          <span className="text-[10px] text-slate-600">No mobile profiles found</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleExecute}
                      disabled={store.isExecuting || selectedProfileIds.length === 0 || (wf.steps ?? []).length === 0}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      {store.isExecuting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      {store.isExecuting ? 'Running...' : `Run on ${selectedProfileIds.length} profile${selectedProfileIds.length !== 1 ? 's' : ''}`}
                    </button>
                  </div>

                  {/* Last Result */}
                  {store.lastResult && (
                    <div className={`mt-3 p-2 rounded-lg text-xs ${
                      (store.lastResult as any).success !== false ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'
                    }`}>
                      {(store.lastResult as any).success !== false ? (
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Completed successfully in {(store.lastResult as any).duration ?? 0}ms</span>
                      ) : (
                        <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Failed: {(store.lastResult as any).error ?? 'Unknown error'}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Action Palette + Behavior */}
              <div className="w-60 border-l border-slate-800 overflow-y-auto p-3">
                {/* Behavior Pattern */}
                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1 mb-2 font-semibold">Behavior Pattern</div>
                  <select
                    value={wf.behaviorPattern ?? ''}
                    onChange={(e) => handleSetBehavior(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                  >
                    <option value="">None (manual timing)</option>
                    {store.archetypes.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  {wf.behaviorPattern && store.archetypes.find((a) => a.id === wf.behaviorPattern) && (
                    <p className="mt-1 text-[10px] text-slate-500 px-1">
                      {store.archetypes.find((a) => a.id === wf.behaviorPattern)!.description}
                    </p>
                  )}
                </div>

                {/* Gesture Actions */}
                <div className="mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1 mb-1.5 font-semibold">Gestures</div>
                  <div className="space-y-0.5">
                    {GESTURE_ACTIONS.map((a) => (
                      <button
                        key={a.action}
                        onClick={() => handleAddStep(a.action)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <a.icon className={`w-3.5 h-3.5 ${a.color}`} />
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sensor Actions */}
                <div className="mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1 mb-1.5 font-semibold">Sensors</div>
                  <div className="space-y-0.5">
                    {SENSOR_ACTIONS.map((a) => (
                      <button
                        key={a.action}
                        onClick={() => handleAddStep(a.action)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <a.icon className={`w-3.5 h-3.5 ${a.color}`} />
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Device Actions */}
                <div className="mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1 mb-1.5 font-semibold">Device Control</div>
                  <div className="space-y-0.5">
                    {DEVICE_ACTIONS.map((a) => (
                      <button
                        key={a.action}
                        onClick={() => handleAddStep(a.action)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <a.icon className={`w-3.5 h-3.5 ${a.color}`} />
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Standard Actions */}
                <div className="mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1 mb-1.5 font-semibold">Standard</div>
                  <div className="space-y-0.5">
                    {STANDARD_ACTIONS.map((a) => (
                      <button
                        key={a.action}
                        onClick={() => handleAddStep(a.action)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <a.icon className={`w-3.5 h-3.5 ${a.color}`} />
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
              Select or create a mobile workflow to get started
            </div>
          )
        ) : (
          /* Execution Logs Tab */
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {store.executionLogs.map((log) => (
                <div key={log.id} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {log.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                      {log.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                      {log.status === 'running' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                      <span className="text-xs font-medium text-white">{log.device_name || 'Unknown'}</span>
                      <span className="text-[10px] text-slate-500">{log.started_at}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">{log.duration_ms}ms</span>
                      <button
                        onClick={() => store.deleteExecutionLog(log.id)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {log.error_message && (
                    <p className="text-[10px] text-red-400 mt-1">{log.error_message}</p>
                  )}
                </div>
              ))}
              {store.executionLogs.length === 0 && (
                <div className="text-center py-12 text-slate-600 text-xs">No execution logs yet</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
