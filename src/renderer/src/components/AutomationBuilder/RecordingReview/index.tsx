/**
 * Phase 17.D — Recording Review Panel
 *
 * Split-panel UI: left = event timeline, right = generated steps diff.
 * Bottom: VariableWizard + RefinementPanel + Save button.
 *
 * State machine: idle → analyzing → analyzed → refining → refined → saving → saved
 */

import React, { useEffect, useState } from 'react'
import {
  X, Loader2, AlertCircle, Wand2, Save, ChevronDown, ChevronUp
} from 'lucide-react'
import { EventTimeline } from './EventTimeline'
import { StepDiff } from './StepDiff'
import { VariableWizard } from './VariableWizard'
import { RefinementPanel } from './RefinementPanel'

type Phase = 'idle' | 'analyzing' | 'analyzed' | 'refining' | 'refined' | 'saving'

interface Props {
  sessionId: string
  profileId: string
  onClose: () => void
  /** Called after a workflow is saved so the parent can refresh the list */
  onSaved: (workflowId: string) => void
}

export function RecordingReview({ sessionId, profileId, onClose, onSaved }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)

  // Session data
  const [session, setSession] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [refined, setRefined] = useState<any>(null)

  // UI state
  const [acceptedVars, setAcceptedVars] = useState<Set<string>>(new Set())
  const [skippedVars, setSkippedVars] = useState<Set<string>>(new Set())
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<string>>(new Set())
  const [showVars, setShowVars] = useState(true)
  const [showSuggestions, setShowSuggestions] = useState(true)

  // Save modal
  const [workflowName, setWorkflowName] = useState('')
  const [workflowDesc, setWorkflowDesc] = useState('')

  // Load session on mount
  useEffect(() => {
    ;(async () => {
      try {
        const s = await window.api.recording.sessions.get(sessionId)
        setSession(s)
        setWorkflowName(`Recording — ${s.page_title || s.start_url || new Date(s.started_at).toLocaleString()}`)
        // Auto-analyze
        await runAnalyze(s)
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load session')
      }
    })()
  }, [sessionId])

  async function runAnalyze(s?: any) {
    setPhase('analyzing')
    setError(null)
    try {
      const result = await window.api.recording.analyze(sessionId)
      setAnalysis(result)
      // Auto-accept variables that are flagged autoApply
      const autoAccepted = new Set<string>(
        (result.extractedVariables ?? [])
          .filter((v: any) => v.autoApply)
          .map((v: any) => v.name as string)
      )
      setAcceptedVars(autoAccepted)
      setPhase('analyzed')
    } catch (e: any) {
      setError(e?.message ?? 'Analysis failed')
      setPhase('idle')
    }
  }

  async function runRefine() {
    setPhase('refining')
    setError(null)
    try {
      const result = await window.api.recording.refine(sessionId, {
        healFragileSelectors: true,
        addRetryOnNetworkActions: true,
        addErrorHandlers: true,
        generateStepLabels: true,
      })
      setRefined(result)
      // Auto-accept all applied suggestions
      const autoAccepted = new Set<string>(
        (result.appliedSuggestions ?? [])
          .filter((s: any) => s.applied)
          .map((s: any) => `${s.stepId}:${s.type}`)
      )
      setAcceptedSuggestions(autoAccepted)
      setPhase('refined')
    } catch (e: any) {
      setError(e?.message ?? 'AI refinement failed')
      setPhase('analyzed')
    }
  }

  async function handleSave() {
    if (!workflowName.trim()) return
    setPhase('saving')
    setError(null)
    try {
      const result = await window.api.recording.saveAsWorkflow(sessionId, workflowName, workflowDesc)
      onSaved(result?.id ?? '')
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save workflow')
      setPhase(refined ? 'refined' : 'analyzed')
    }
  }

  const rawSteps = analysis?.suggestedWorkflow?.steps ?? []
  const analyzedSteps = analysis?.suggestedWorkflow?.steps ?? []
  const refinedSteps = refined?.refinedSteps ?? null
  const events = session?.events ?? []
  const variables = analysis?.extractedVariables ?? []
  const suggestions = refined?.appliedSuggestions ?? []

  return (
    <div className="fixed inset-0 bg-black/70 flex items-stretch justify-center z-40 p-4">
      <div className="flex flex-col bg-slate-900 border border-slate-700 rounded-xl w-full max-w-6xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <Wand2 className="w-5 h-5 text-ghost-400" />
            <div>
              <h2 className="text-sm font-semibold text-white">Recording Review</h2>
              <p className="text-xs text-slate-500">{session?.page_title ?? session?.start_url ?? sessionId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {phase === 'analyzed' && (
              <button
                onClick={runRefine}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Refine with AI
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-700 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs shrink-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400">&times;</button>
          </div>
        )}

        {/* Loading state */}
        {(phase === 'analyzing' || phase === 'refining' || phase === 'saving') && (
          <div className="flex items-center gap-3 px-5 py-3 bg-ghost-600/5 border-b border-ghost-500/10 shrink-0">
            <Loader2 className="w-4 h-4 text-ghost-400 animate-spin" />
            <span className="text-sm text-slate-300">
              {phase === 'analyzing' && 'Analyzing recording...'}
              {phase === 'refining' && 'Running AI refinement...'}
              {phase === 'saving' && 'Saving workflow...'}
            </span>
          </div>
        )}

        {/* Main split panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Event Timeline */}
          <div className="w-80 border-r border-slate-800 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-800 shrink-0">
              <span className="text-xs font-medium text-slate-400">Event Timeline</span>
              <span className="text-xs text-slate-600 ml-2">{events.length} events</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <EventTimeline events={events} screenshots={[]} />
            </div>
          </div>

          {/* Right: Step Diff + bottom panels */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Step diff */}
            <div className="flex-1 overflow-hidden p-4">
              <StepDiff
                rawSteps={rawSteps}
                analyzedSteps={analyzedSteps}
                refinedSteps={refinedSteps ?? undefined}
              />
            </div>

            {/* Bottom panels */}
            <div className="border-t border-slate-800 shrink-0 max-h-72 overflow-y-auto">
              {/* Variable Wizard */}
              {variables.length > 0 && (
                <div className="border-b border-slate-800">
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800/50 transition-colors"
                    onClick={() => setShowVars(!showVars)}
                  >
                    {showVars ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Extracted Variables ({variables.length})
                    <span className="ml-auto text-ghost-400">{acceptedVars.size} accepted</span>
                  </button>
                  {showVars && (
                    <div className="px-4 pb-3">
                      <VariableWizard
                        variables={variables}
                        accepted={acceptedVars}
                        onAccept={(name) => setAcceptedVars((prev) => new Set([...prev, name]))}
                        onSkip={(name) => {
                          setSkippedVars((prev) => new Set([...prev, name]))
                          setAcceptedVars((prev) => { const n = new Set(prev); n.delete(name); return n })
                        }}
                        onEdit={(oldName, newName) => {
                          setAcceptedVars((prev) => {
                            const n = new Set(prev)
                            if (n.has(oldName)) { n.delete(oldName); n.add(newName) }
                            return n
                          })
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Refinement Panel */}
              {suggestions.length > 0 && (
                <div>
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800/50 transition-colors"
                    onClick={() => setShowSuggestions(!showSuggestions)}
                  >
                    {showSuggestions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    AI Suggestions ({suggestions.length})
                    <span className="ml-auto text-ghost-400">{acceptedSuggestions.size} accepted</span>
                  </button>
                  {showSuggestions && (
                    <div className="px-4 pb-3">
                      <RefinementPanel
                        suggestions={suggestions}
                        accepted={acceptedSuggestions}
                        onAccept={(stepId, type) => setAcceptedSuggestions((prev) => new Set([...prev, `${stepId}:${type}`]))}
                        onReject={(stepId, type) => setAcceptedSuggestions((prev) => { const n = new Set(prev); n.delete(`${stepId}:${type}`); return n })}
                        aiNotes={refined?.aiNotes}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Save bar */}
            {(phase === 'analyzed' || phase === 'refined' || phase === 'saving') && (
              <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-800 bg-slate-900 shrink-0">
                <input
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="Workflow name..."
                  className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ghost-500"
                />
                <input
                  value={workflowDesc}
                  onChange={(e) => setWorkflowDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-48 bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ghost-500"
                />
                <button
                  onClick={handleSave}
                  disabled={!workflowName.trim() || phase === 'saving'}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save as Workflow
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
