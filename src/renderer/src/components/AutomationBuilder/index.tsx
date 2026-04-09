import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Play,
  Plus,
  Trash2,
  Square,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bot,
  Layers,
  Calendar,
  Circle,
  StopCircle,
  Download,
  Upload,
  Loader2,
  Keyboard
} from 'lucide-react'
import { useAutomationStore } from '../../stores/automationStore'
import { useProfileStore } from '../../stores/profileStore'
import { useToastStore } from '../../stores/toastStore'
// Phase 17.H — Platform-Specific Detection Hardening
import { useHardenerStore } from '../../stores/hardenerStore'
import { PreFlightValidator } from './PreFlightValidator'
import { StepEditor } from './StepEditor'
import { WorkflowCreateModal } from './WorkflowCreateModal'
import { WorkflowCreationFlow, type WorkflowCreationMethod } from './WorkflowCreationFlow'
import { TemplatePickerModal } from './TemplatePickerModal'
import { SchedulesModal } from './SchedulesModal'
import { VariablesEditor } from './VariablesEditor'
import { RecordingReview } from './RecordingReview'
import { WorkflowSidebar } from './WorkflowSidebar'
import { WorkflowStats } from './WorkflowStats'
import { StepsToolbar, type StepFilterMode } from './StepsToolbar'
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp'
import { validateStep } from './stepValidator'
import type { AutomationStep, AutomationStepResult, NavSection } from '../../types'

interface AutomationBuilderProps {
  onNavigate?: (section: NavSection) => void
}

export function AutomationBuilder({ onNavigate }: AutomationBuilderProps = {}) {
  const {
    workflows, selectedWorkflow, runResult, parallelResults, runHistory,
    loading, running, error,
    fetchWorkflows, selectWorkflow, createWorkflow, updateWorkflow, deleteWorkflow,
    runWorkflow, runWorkflowParallel, stopWorkflow, stopWorkflowAll, clearError
  } = useAutomationStore()

  const { profiles, activeSessions, fetchActiveSessions } = useProfileStore()
  const pushToast = useToastStore((s) => s.push)
  // Phase 17.H — Platform-Specific Detection Hardening
  const preFlight = useHardenerStore((s) => s.preFlight)
  const liveAdjustment = useHardenerStore((s) => s.liveAdjustment)
  const setPreFlight = useHardenerStore((s) => s.setPreFlight)
  const setLiveAdjustment = useHardenerStore((s) => s.setLiveAdjustment)
  const validateHardener = useHardenerStore((s) => s.validate)
  const applyHardenerFix = useHardenerStore((s) => s.applyFix)
  const dismissHardener = useHardenerStore((s) => s.dismiss)
  const [showCreationFlow, setShowCreationFlow] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSchedules, setShowSchedules] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  // Phase 10.1 — parallel run mode
  const [parallelMode, setParallelMode] = useState(false)
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set())
  const [concurrency, setConcurrency] = useState(3)
  // Phase 12.B.4 — per-run variable overrides (key → value)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  // Phase 12.B.2 — visual recorder
  const [recording, setRecording] = useState(false)
  const [recordingProfileId, setRecordingProfileId] = useState<string | null>(null)
  const [recordedCount, setRecordedCount] = useState(0)
  const [recorderError, setRecorderError] = useState<string | null>(null)
  // Phase 17 — Recording Review
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null)
  // Live step progress stream
  const [liveSteps, setLiveSteps] = useState<AutomationStepResult[]>([])
  // Import file ref
  const importInputRef = useRef<HTMLInputElement>(null)
  // Drag & Drop state
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null)
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null)
  // Steps toolbar — bulk expand/collapse and quick filter by validation state
  const [forceExpandTick, setForceExpandTick] = useState<number>(0)
  const [forceExpandValue, setForceExpandValue] = useState<boolean | undefined>(undefined)
  const [stepFilter, setStepFilter] = useState<StepFilterMode>('all')
  // Keyboard shortcuts cheatsheet
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Reset overrides and live steps when switching workflows
  useEffect(() => {
    setOverrides({})
    setLiveSteps([])
  }, [selectedWorkflow?.id])

  useEffect(() => {
    fetchWorkflows()
  }, [])

  useEffect(() => {
    if (activeSessions.length > 0 && !selectedProfileId) {
      setSelectedProfileId(activeSessions[0])
    }
  }, [activeSessions])

  // Subscribe to live step progress events from main process
  useEffect(() => {
    const unsubscribe = window.api.automation.onStepProgress(({ workflowId, step }) => {
      if (selectedWorkflow && workflowId === selectedWorkflow.id) {
        setLiveSteps((prev) => {
          // Replace existing entry for this stepId (retry), otherwise append
          const idx = prev.findIndex((s) => s.stepId === step.stepId)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = step
            return next
          }
          return [...prev, step]
        })
      }
    })
    return unsubscribe
  }, [selectedWorkflow?.id])

  // Phase 17.H — Subscribe to pre-flight validator results emitted by main.
  useEffect(() => {
    const unsubscribe = window.api.automation.onPreFlight((result: any) => {
      setPreFlight(result)
    })
    return unsubscribe
  }, [setPreFlight])

  // Phase 17.H — Subscribe to live-adjustment events emitted mid-run. Surface
  // them as a toast with an "Apply fix" action the user can click to patch
  // the profile on the fly without aborting the workflow.
  useEffect(() => {
    const unsubscribe = window.api.automation.onLiveAdjustment((event: any) => {
      setLiveAdjustment(event)
      const label = event?.suggestedFix?.label ?? 'Tune profile'
      pushToast(
        `${event.description || 'Detection challenge observed'} · ${label}`,
        'error'
      )
      // Auto-apply when the event is flagged as such (reserved for future use).
      if (event?.autoApplied && event?.profileId && event?.suggestedFix) {
        applyHardenerFix(event.profileId, event.suggestedFix).catch(() => { /* toast already shown */ })
      }
    })
    return unsubscribe
  }, [setLiveAdjustment, applyHardenerFix, pushToast])

  // Fetch active sessions on mount and refresh every 3 seconds
  useEffect(() => {
    fetchActiveSessions()
    const interval = setInterval(fetchActiveSessions, 3000)
    return () => clearInterval(interval)
  }, [fetchActiveSessions])

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

  const handleDragStart = (_e: React.DragEvent<HTMLButtonElement>, index: number) => {
    setDraggedStepIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedStepIndex(null)
    setDraggedOverIndex(null)
  }

  const handleDragOver = (_e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedOverIndex(index)
  }

  const handleDragLeave = () => {
    setDraggedOverIndex(null)
  }

  const handleDrop = (targetIndex: number) => {
    if (!selectedWorkflow || draggedStepIndex === null) return
    if (draggedStepIndex === targetIndex) {
      setDraggedStepIndex(null)
      setDraggedOverIndex(null)
      return
    }

    const steps = [...selectedWorkflow.steps]
    const [draggedStep] = steps.splice(draggedStepIndex, 1)
    steps.splice(targetIndex, 0, draggedStep)
    updateWorkflow(selectedWorkflow.id, { steps })

    setDraggedStepIndex(null)
    setDraggedOverIndex(null)
    pushToast('Step reordered', 'success')
  }

  const handleRun = async () => {
    if (!selectedWorkflow) return
    setLiveSteps([])
    // Only send non-empty overrides — engine merges them on top of stored variables
    const runtimeVars: Record<string, string> = {}
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== '') runtimeVars[k] = v
    }
    const vars = Object.keys(runtimeVars).length > 0 ? runtimeVars : undefined
    try {
      if (parallelMode) {
        if (selectedProfileIds.size === 0) return
        await runWorkflowParallel(
          selectedWorkflow.id,
          Array.from(selectedProfileIds),
          vars,
          concurrency
        )
      } else {
        if (!selectedProfileId) return
        await runWorkflow(selectedWorkflow.id, selectedProfileId, vars)
      }
    } catch { /* error is set in store */ }
  }

  const handleStop = () => {
    if (!selectedWorkflow) return
    if (parallelMode) {
      stopWorkflowAll(selectedWorkflow.id)
    } else if (selectedProfileId) {
      stopWorkflow(selectedWorkflow.id, selectedProfileId)
    }
  }

  // ── Visual recorder (Phase 12.B.2) ─────────────────────────────────────────
  const handleStartRecording = async () => {
    if (!selectedProfileId) return
    setRecorderError(null)
    try {
      // Phase 17: capture network events for richer analysis
      await window.api.recorder.start(selectedProfileId, true, true)
      setRecording(true)
      setRecordingProfileId(selectedProfileId)
      setRecordedCount(0)
    } catch (e: any) {
      setRecorderError(e?.message ?? 'Failed to start recorder')
    }
  }

  const handleStopRecording = async () => {
    if (!recordingProfileId) {
      setRecording(false)
      setRecordingProfileId(null)
      return
    }
    try {
      const result = await window.api.recorder.stop(recordingProfileId)
      // Phase 17: open Recording Review panel if we got a sessionId
      if (result.sessionId) {
        setReviewSessionId(result.sessionId)
      } else if (selectedWorkflow) {
        // Fallback: append steps directly (old behavior)
        const newSteps = result.steps || []
        if (newSteps.length > 0) {
          await updateWorkflow(selectedWorkflow.id, {
            steps: [...selectedWorkflow.steps, ...newSteps]
          })
        }
      }
    } catch (e: any) {
      setRecorderError(e?.message ?? 'Failed to stop recorder')
    } finally {
      setRecording(false)
      setRecordingProfileId(null)
      setRecordedCount(0)
    }
  }

  // Poll recorder state while recording for a live step counter.
  useEffect(() => {
    if (!recording || !recordingProfileId) return
    const id = setInterval(async () => {
      try {
        const s = await window.api.recorder.state(recordingProfileId)
        if (!s.recording) {
          setRecording(false)
          setRecordingProfileId(null)
          setRecordedCount(0)
          return
        }
        setRecordedCount(s.steps?.length ?? 0)
      } catch {
        // ignore — most likely the profile was closed
      }
    }, 1000)
    return () => clearInterval(id)
  }, [recording, recordingProfileId])

  const toggleProfileSelection = (id: string) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleTemplateCreated = async (workflow: any) => {
    await fetchWorkflows()
    selectWorkflow(workflow.id)
    setShowTemplates(false)
  }

  // Phase 1 UX — Route the user from the Guided Entry Point to the right
  // creation path. Each method opens the appropriate existing modal or
  // triggers the matching flow (recording, AI, etc.).
  const handleCreationMethod = (method: WorkflowCreationMethod) => {
    setShowCreationFlow(false)
    switch (method) {
      case 'record': {
        // Recording needs a launched profile. If the user doesn't have one
        // ready, guide them clearly instead of failing silently.
        if (!selectedProfileId) {
          pushToast(
            'Select a profile on the right, then click "Start Recording" to capture your steps.',
            'info',
            6000
          )
          return
        }
        if (!activeSessions.includes(selectedProfileId)) {
          pushToast(
            'Launch the selected profile first, then click "Start Recording".',
            'info',
            6000
          )
          return
        }
        // Profile is ready — kick off the recorder immediately.
        void handleStartRecording()
        pushToast(
          'Recording started. Do the task in the browser, then click "Stop Recording".',
          'success',
          5000
        )
        return
      }
      case 'template':
        setShowTemplates(true)
        return
      case 'ai':
        if (onNavigate) {
          onNavigate('ai')
          pushToast(
            'Describe what you want to automate in the AI Assistant, then import the generated steps.',
            'info',
            6000
          )
        } else {
          // Fallback if navigation isn't wired — point the user in the
          // right direction.
          pushToast(
            'Open the AI Assistant from the sidebar to generate a workflow from a plain-English description.',
            'info',
            6000
          )
        }
        return
      case 'scratch':
        setShowCreate(true)
        return
    }
  }

  // ── Export workflow as JSON ──────────────────────────────────────────────────
  const handleExport = () => {
    if (!selectedWorkflow) return
    const exportData = {
      name: selectedWorkflow.name,
      description: selectedWorkflow.description,
      steps: selectedWorkflow.steps,
      variables: selectedWorkflow.variables ?? {}
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedWorkflow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Bulk expand/collapse steps ──────────────────────────────────────────────
  // We use a "tick" pattern so clicking Expand All twice in a row still
  // re-expands steps even if the value hasn't changed — this lets a user
  // re-apply the bulk action after manually collapsing a few steps.
  const handleExpandAll = () => {
    setForceExpandValue(true)
    setForceExpandTick((t) => t + 1)
  }
  const handleCollapseAll = () => {
    setForceExpandValue(false)
    setForceExpandTick((t) => t + 1)
  }

  // Filter steps for the visible list while keeping the original index so
  // drag-and-drop, ordering, and navigation stay consistent.
  const visibleSteps = useMemo(() => {
    if (!selectedWorkflow) return [] as Array<{ step: AutomationStep; index: number }>
    const all = selectedWorkflow.steps.map((step, index) => ({ step, index }))
    if (stepFilter === 'all') return all
    return all.filter(({ step }) => {
      const result = validateStep(step)
      if (stepFilter === 'invalid') return result.level === 'invalid'
      if (stepFilter === 'incomplete')
        return result.level === 'invalid' || result.level === 'incomplete'
      return true
    })
  }, [selectedWorkflow, stepFilter])

  // Validation counts feed the filter chips in StepsToolbar
  const stepValidationCounts = useMemo(() => {
    if (!selectedWorkflow) return { invalid: 0, incomplete: 0 }
    let invalid = 0
    let incomplete = 0
    for (const step of selectedWorkflow.steps) {
      const result = validateStep(step)
      if (result.level === 'invalid') invalid++
      else if (result.level === 'incomplete') incomplete++
    }
    return { invalid, incomplete }
  }, [selectedWorkflow])

  // Last-run status map for the sidebar badges. We only have run history for
  // the currently-selected workflow (lazy-fetched on select), so this map
  // covers the active workflow only — enough to give a visible indicator
  // after the user has run it at least once.
  const lastRunsMap = useMemo(() => {
    const map: Record<string, { status: 'completed' | 'failed' | 'stopped'; at: string }> = {}
    if (selectedWorkflow && runHistory.length > 0) {
      const latest = runHistory[0]
      map[selectedWorkflow.id] = {
        status: latest.status,
        at: latest.started_at
      }
    }
    return map
  }, [selectedWorkflow, runHistory])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  // Keep a ref to the latest handlers + state so the global key listener
  // doesn't capture stale closures. This lets us register the listener once
  // and still react to the current workflow / run state every keystroke.
  const shortcutRef = useRef({
    selectedWorkflow,
    running,
    handleRun,
    handleStop,
    handleExport,
    handleAddStep,
    handleExpandAll,
    handleCollapseAll
  })
  shortcutRef.current = {
    selectedWorkflow,
    running,
    handleRun,
    handleStop,
    handleExport,
    handleAddStep,
    handleExpandAll,
    handleCollapseAll
  }

  useEffect(() => {
    const isEditableTarget = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false
      const tag = t.tagName
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        t.isContentEditable
      )
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const ctx = shortcutRef.current

      // "?" opens the cheatsheet regardless, as long as we're not typing.
      if (e.key === '?' && !isEditableTarget(e.target)) {
        e.preventDefault()
        setShowShortcuts(true)
        return
      }

      // Everything else is Ctrl/Cmd-prefixed.
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      // When the user is typing in a field, only Ctrl+Enter is allowed so it
      // can kick off a run without having to click away first.
      if (isEditableTarget(e.target) && !(e.ctrlKey && e.key === 'Enter')) {
        return
      }

      const key = e.key.toLowerCase()

      // Ctrl+N — new workflow
      if (key === 'n' && !e.shiftKey) {
        e.preventDefault()
        setShowCreationFlow(true)
        return
      }
      // Ctrl+T — templates
      if (key === 't' && !e.shiftKey) {
        e.preventDefault()
        setShowTemplates(true)
        return
      }
      // Ctrl+I — import
      if (key === 'i' && !e.shiftKey) {
        e.preventDefault()
        importInputRef.current?.click()
        return
      }
      // Ctrl+E — export (only if a workflow is selected)
      if (key === 'e' && !e.shiftKey && ctx.selectedWorkflow) {
        e.preventDefault()
        ctx.handleExport()
        return
      }
      // Ctrl+K — focus search in sidebar
      if (key === 'k' && !e.shiftKey) {
        e.preventDefault()
        const input = document.querySelector<HTMLInputElement>(
          'input[placeholder="Search workflows…"]'
        )
        input?.focus()
        input?.select()
        return
      }
      // Ctrl+Enter — run
      if (e.key === 'Enter' && ctx.selectedWorkflow && !ctx.running) {
        e.preventDefault()
        ctx.handleRun()
        return
      }
      // Ctrl+. — stop
      if (e.key === '.' && ctx.selectedWorkflow && ctx.running) {
        e.preventDefault()
        ctx.handleStop()
        return
      }
      // Ctrl+Shift+A — add step
      if (e.shiftKey && key === 'a' && ctx.selectedWorkflow) {
        e.preventDefault()
        ctx.handleAddStep()
        return
      }
      // Ctrl+Shift+E — expand all
      if (e.shiftKey && key === 'e' && ctx.selectedWorkflow) {
        e.preventDefault()
        ctx.handleExpandAll()
        return
      }
      // Ctrl+Shift+C — collapse all
      if (e.shiftKey && key === 'c' && ctx.selectedWorkflow) {
        e.preventDefault()
        ctx.handleCollapseAll()
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── Import workflow from JSON file ──────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.name || !Array.isArray(data.steps)) {
        throw new Error('Invalid workflow JSON: must have name and steps array')
      }
      // Reassign all step IDs to avoid conflicts
      const steps = data.steps.map((s: any) => ({ ...s, id: crypto.randomUUID() }))
      const w = await createWorkflow({
        name: data.name,
        description: data.description,
        steps,
        variables: data.variables
      })
      selectWorkflow(w.id)
    } catch (err: any) {
      alert(`Import failed: ${err.message}`)
    } finally {
      // Reset file input so the same file can be re-imported
      if (importInputRef.current) importInputRef.current.value = ''
    }
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
        <div className="flex items-center gap-2">
          {/* Hidden import file input */}
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
            title="Import workflow from JSON file"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
            title="Browse pre-built workflow templates"
          >
            <Layers className="w-4 h-4" />
            Templates
          </button>
          <button
            onClick={() => setShowCreationFlow(true)}
            className="flex items-center gap-2 px-3 py-2 bg-ghost-600 hover:bg-ghost-700 text-white text-sm font-medium rounded-lg transition-colors"
            title="Create a new workflow — Ctrl+N"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
          <button
            onClick={() => setShowShortcuts(true)}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
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
        {/* Workflow list sidebar with search + sort + last-run badges */}
        <WorkflowSidebar
          workflows={workflows}
          selectedId={selectedWorkflow?.id ?? null}
          loading={loading}
          lastRuns={lastRunsMap}
          onSelect={selectWorkflow}
        />

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
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Export workflow as JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                  <button
                    onClick={() => setShowSchedules(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Manage schedules"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Schedules
                  </button>
                  <button
                    onClick={() => deleteWorkflow(selectedWorkflow.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Delete workflow"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Workflow stats strip — step count, variables, health, success rate */}
              <WorkflowStats workflow={selectedWorkflow} runHistory={runHistory} />

              {/* Variables editor — Phase 12.B.4 */}
              <VariablesEditor
                workflow={selectedWorkflow}
                onSave={async (variables) => {
                  await updateWorkflow(selectedWorkflow.id, { variables })
                }}
              />

              {/* Built-in variable hint */}
              <div className="mb-4 p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/40 text-xs text-slate-500">
                Built-in variables available in every run:
                {' '}<code className="text-ghost-400 font-mono">{'{timestamp}'}</code>
                {' '}<code className="text-ghost-400 font-mono">{'{runId}'}</code>
                {' '}<code className="text-ghost-400 font-mono">{'{random}'}</code>
                {' '}<code className="text-ghost-400 font-mono">{'{profileName}'}</code>
              </div>

              {/* Phase 17.H — Pre-flight validator card */}
              <PreFlightValidator
                result={preFlight && preFlight.workflowId === selectedWorkflow.id ? preFlight : null}
                profileId={preFlight?.profileId ?? (selectedProfileId || null)}
                onDismiss={dismissHardener}
                onRunAnyway={() => {
                  dismissHardener()
                  handleRun()
                }}
                onFixAndRun={() => {
                  dismissHardener()
                  handleRun()
                }}
              />

              {/* Run controls */}
              <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setParallelMode(false)}
                    className={`px-3 py-1.5 rounded ${!parallelMode ? 'bg-ghost-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                  >
                    Single profile
                  </button>
                  <button
                    onClick={() => setParallelMode(true)}
                    className={`px-3 py-1.5 rounded ${parallelMode ? 'bg-ghost-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                  >
                    Parallel ({selectedProfileIds.size} selected)
                  </button>
                  {parallelMode && (
                    <label className="ml-auto flex items-center gap-2 text-slate-400">
                      Concurrency
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={concurrency}
                        onChange={(e) => setConcurrency(Math.max(1, Math.min(20, parseInt(e.target.value || '1', 10))))}
                        className="w-16 bg-slate-700 border border-slate-600 text-white rounded px-2 py-1"
                      />
                    </label>
                  )}
                </div>

                {parallelMode ? (
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-700 rounded p-2 bg-slate-900/50">
                    {profiles.length === 0 ? (
                      <div className="text-xs text-slate-500 p-2">No profiles available.</div>
                    ) : (
                      profiles.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm text-slate-300 hover:bg-slate-800 rounded px-2 py-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedProfileIds.has(p.id)}
                            onChange={() => toggleProfileSelection(p.id)}
                            className="accent-ghost-500"
                          />
                          <span className="flex-1">{p.name}</span>
                          {activeSessions.includes(p.id) && (
                            <span className="text-[10px] uppercase text-green-400">running</span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                ) : (
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ghost-500"
                  >
                    <option value="">Select a profile...</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {activeSessions.includes(p.id) ? '(running)' : ''}
                      </option>
                    ))}
                  </select>
                )}

                {/* Per-run variable overrides — Phase 12.B.4 */}
                {Object.keys(selectedWorkflow.variables ?? {}).length > 0 && (
                  <div className="border-t border-slate-700/50 pt-3">
                    <div className="text-xs text-slate-400 mb-2">Run-time overrides (optional)</div>
                    <div className="space-y-1.5">
                      {Object.entries(selectedWorkflow.variables ?? {}).map(([key, defaultValue]) => (
                        <div key={key} className="flex items-center gap-2">
                          <code className="w-32 text-xs text-slate-300 font-mono truncate" title={key}>{key}</code>
                          <input
                            value={overrides[key] ?? ''}
                            onChange={(e) => setOverrides((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder={defaultValue || '(empty)'}
                            className="flex-1 bg-slate-900/60 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-ghost-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  {/* Record button (only for single-profile mode, when active session) */}
                  {!parallelMode && (
                    recording ? (
                      <button
                        onClick={handleStopRecording}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors animate-pulse"
                        title="Stop recording and append captured steps to this workflow"
                      >
                        <StopCircle className="w-4 h-4" />
                        Stop recording ({recordedCount})
                      </button>
                    ) : (
                      <button
                        onClick={handleStartRecording}
                        disabled={!selectedProfileId || !activeSessions.includes(selectedProfileId) || running}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-600/20 hover:bg-rose-600/40 disabled:bg-slate-700 disabled:text-slate-500 text-rose-300 hover:text-white text-sm font-medium rounded-lg border border-rose-600/40 transition-colors"
                        title="Start recording interactions on the selected running profile"
                      >
                        <Circle className="w-3 h-3 fill-current" />
                        Record
                      </button>
                    )
                  )}
                  {running ? (
                    <button
                      onClick={handleStop}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <Square className="w-4 h-4" />
                      Stop {parallelMode ? 'all' : ''}
                    </button>
                  ) : (
                    <>
                      {/* Phase 17.H — Pre-flight validator (ad-hoc) */}
                      {!parallelMode && (
                        <button
                          onClick={async () => {
                            if (!selectedProfileId) return
                            try {
                              await validateHardener(selectedWorkflow.id, selectedProfileId)
                            } catch (e: any) {
                              pushToast(e?.message ?? 'Pre-flight validation failed', 'error')
                            }
                          }}
                          disabled={!selectedProfileId || selectedWorkflow.steps.length === 0}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-200 text-sm font-medium rounded-lg transition-colors"
                          title="Run the platform-specific detection hardening pre-flight validator"
                        >
                          <Bot className="w-4 h-4" />
                          Pre-flight
                        </button>
                      )}
                      <button
                        onClick={handleRun}
                        disabled={
                          selectedWorkflow.steps.length === 0 ||
                          (parallelMode
                            ? selectedProfileIds.size === 0
                            : !selectedProfileId || !activeSessions.includes(selectedProfileId))
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        Run{parallelMode ? ` × ${selectedProfileIds.size}` : ''}
                      </button>
                    </>
                  )}
                </div>

                {recorderError && (
                  <div className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {recorderError}
                  </div>
                )}
                {recording && (
                  <div className="text-xs text-rose-300 flex items-center gap-2 px-3 py-2 rounded-md bg-rose-600/10 border border-rose-600/30">
                    <Circle className="w-2.5 h-2.5 fill-current animate-pulse" />
                    Recording — interact with the browser, then click <strong>Stop recording</strong> to append the captured steps to this workflow.
                  </div>
                )}
              </div>

              {/* Live step progress — shown while running */}
              {running && liveSteps.length > 0 && (
                <div className="mb-6 p-4 rounded-lg border border-ghost-500/20 bg-ghost-600/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Loader2 className="w-4 h-4 text-ghost-400 animate-spin" />
                    <span className="text-sm font-medium text-white">Running — live progress</span>
                    <span className="text-xs text-slate-500">{liveSteps.length} step{liveSteps.length !== 1 ? 's' : ''} executed</span>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {liveSteps.map((sr, i) => (
                      <div key={`${sr.stepId}-${i}`} className="flex items-center gap-2 text-xs">
                        {sr.success
                          ? <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />
                          : <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                        }
                        <span className="text-slate-400 w-28 truncate">{sr.action}</span>
                        <span className="text-slate-600">{sr.duration_ms}ms</span>
                        {sr.error && <span className="text-red-400 truncate flex-1">{sr.error}</span>}
                        {sr.output?.text && <span className="text-slate-500 truncate flex-1 font-mono">{sr.output.text}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parallel results summary */}
              {parallelResults && parallelResults.length > 0 && (
                <div className="mb-6 p-4 rounded-lg border border-slate-700/50 bg-slate-800/40">
                  <div className="text-sm font-medium text-white mb-3">
                    Parallel run — {parallelResults.filter(r => r.status === 'completed').length}/{parallelResults.length} completed
                  </div>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {parallelResults.map((r) => {
                      const profile = profiles.find(p => p.id === r.profileId)
                      return (
                        <div key={r.profileId} className="flex items-center gap-2 text-xs">
                          {r.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                          {r.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                          {r.status === 'stopped' && <Square className="w-3.5 h-3.5 text-yellow-400" />}
                          <span className="text-slate-300 flex-1 truncate">{profile?.name ?? r.profileId}</span>
                          <span className="text-slate-500">{r.stepResults.length} steps</span>
                          {r.error && <span className="text-red-400 truncate max-w-[200px]">{r.error}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Run result */}
              {runResult && !running && (
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
                        <span className="text-slate-400 w-28 truncate">{sr.action}</span>
                        <span className="text-slate-600">{sr.duration_ms}ms</span>
                        {sr.error && <span className="text-red-400 truncate flex-1">{sr.error}</span>}
                        {sr.output?.text && <span className="text-slate-500 truncate flex-1 font-mono">{String(sr.output.text).slice(0, 60)}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Steps toolbar — expand/collapse all + validation filter chips */}
              <StepsToolbar
                stepCount={selectedWorkflow.steps.length}
                invalidCount={stepValidationCounts.invalid}
                incompleteCount={stepValidationCounts.incomplete}
                allExpanded={forceExpandValue === true}
                filterMode={stepFilter}
                onExpandAll={handleExpandAll}
                onCollapseAll={handleCollapseAll}
                onFilterChange={setStepFilter}
              />

              {/* Steps */}
              <div className="space-y-3">
                {visibleSteps.length === 0 && selectedWorkflow.steps.length > 0 && (
                  <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-700 rounded-lg">
                    No steps match the current filter.{' '}
                    <button
                      onClick={() => setStepFilter('all')}
                      className="text-ghost-400 hover:text-ghost-300 underline"
                    >
                      Show all steps
                    </button>
                  </div>
                )}
                {visibleSteps.map(({ step, index: idx }) => (
                  <StepEditor
                    key={step.id}
                    step={step}
                    index={idx}
                    total={selectedWorkflow.steps.length}
                    onUpdate={(updates) => handleUpdateStep(step.id, updates)}
                    onDelete={() => handleDeleteStep(step.id)}
                    onDuplicate={() => handleDuplicateStep(step.id)}
                    onMove={(dir) => handleMoveStep(step.id, dir)}
                    isDragging={draggedStepIndex === idx}
                    draggedOverIndex={draggedOverIndex}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(_, targetIndex) => handleDrop(targetIndex)}
                    previousActionType={selectedWorkflow.steps[idx - 1]?.action}
                    forceExpanded={forceExpandValue}
                    forceExpandTick={forceExpandTick}
                  />
                ))}

                <button
                  onClick={handleAddStep}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-700 hover:border-ghost-500 text-slate-500 hover:text-ghost-400 rounded-lg transition-colors"
                  title="Add a new step — Ctrl+Shift+A"
                >
                  <Plus className="w-4 h-4" />
                  Add Step
                </button>
              </div>

              {/* Run History */}
              {runHistory.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-slate-300">Run History</h3>
                    <span className="text-[10px] text-slate-500">
                      Last {Math.min(runHistory.length, 10)} of {runHistory.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {runHistory.slice(0, 10).map((run: any) => {
                      const failedSteps = run.step_results.filter((s: any) => !s.success).length
                      const duration = run.completed_at
                        ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
                        : null
                      return (
                        <div
                          key={run.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs border ${
                            run.status === 'completed'
                              ? 'bg-slate-800/50 border-transparent'
                              : run.status === 'failed'
                                ? 'bg-red-500/5 border-red-500/15'
                                : 'bg-yellow-500/5 border-yellow-500/15'
                          }`}
                        >
                          {run.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                          {run.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                          {run.status === 'stopped' && <Square className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                          <span className="text-slate-400 capitalize w-16">{run.status}</span>
                          <span className="text-slate-500">
                            {run.step_results.length} step{run.step_results.length === 1 ? '' : 's'}
                          </span>
                          {failedSteps > 0 && (
                            <span className="text-red-400">· {failedSteps} failed</span>
                          )}
                          {duration !== null && (
                            <span className="text-slate-600">
                              · {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
                            </span>
                          )}
                          <Clock className="w-3 h-3 text-slate-600 ml-auto shrink-0" />
                          <span className="text-slate-500">
                            {new Date(run.started_at).toLocaleString()}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Bot className="w-12 h-12 text-slate-700 mb-4" />
              <h2 className="text-lg font-medium text-slate-400 mb-2">Select or create a workflow</h2>
              <p className="text-sm text-slate-500 max-w-md mb-4">
                Build automation workflows to control browser profiles. Add steps like navigate, click,
                type, screenshot, and more — then run them on any active profile.
              </p>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button
                  onClick={() => setShowCreationFlow(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-ghost-600 hover:bg-ghost-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Workflow
                </button>
                <button
                  onClick={() => setShowTemplates(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
                >
                  <Layers className="w-4 h-4" />
                  Browse Templates
                </button>
                <button
                  onClick={() => importInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Import JSON
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phase 1 UX — Guided Entry Point: 4-method workflow creation picker */}
      {showCreationFlow && (
        <WorkflowCreationFlow
          onClose={() => setShowCreationFlow(false)}
          onSelectMethod={handleCreationMethod}
          isFirstTime={workflows.length === 0}
        />
      )}

      {/* "Build from scratch" — the original blank-workflow modal (now only
          reached from the guided entry point) */}
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

      {/* Template picker modal */}
      {showTemplates && (
        <TemplatePickerModal
          onClose={() => setShowTemplates(false)}
          onCreated={handleTemplateCreated}
        />
      )}

      {/* Schedules modal — Phase 10.2 */}
      {showSchedules && selectedWorkflow && (
        <SchedulesModal
          workflow={selectedWorkflow}
          profiles={profiles}
          onClose={() => setShowSchedules(false)}
        />
      )}

      {/* Phase 17 — Recording Review panel */}
      {reviewSessionId && recordingProfileId == null && (
        <RecordingReview
          sessionId={reviewSessionId}
          profileId={selectedProfileId}
          onClose={() => setReviewSessionId(null)}
          onSaved={async (workflowId) => {
            setReviewSessionId(null)
            await fetchWorkflows()
            if (workflowId) selectWorkflow(workflowId)
          }}
        />
      )}

      {/* Keyboard shortcuts cheatsheet */}
      {showShortcuts && <KeyboardShortcutsHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}
