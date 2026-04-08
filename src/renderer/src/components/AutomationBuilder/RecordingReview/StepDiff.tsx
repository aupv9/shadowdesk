import React, { useState } from 'react'
import { GitCompare } from 'lucide-react'

interface AutomationStep {
  id: string
  action: string
  label?: string
  params?: Record<string, any>
  retries?: number
}

interface Props {
  rawSteps: AutomationStep[]
  analyzedSteps: AutomationStep[]
  refinedSteps?: AutomationStep[]
}

type View = 'raw' | 'analyzed' | 'refined'

function StepCard({ step, index }: { step: AutomationStep; index: number }) {
  return (
    <div className="flex items-start gap-2 p-2 bg-slate-900/50 rounded border border-slate-700/40 text-xs">
      <span className="text-slate-600 w-5 shrink-0 text-right">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-ghost-400 font-mono">{step.action}</code>
          <span className="text-slate-400 truncate">{step.label}</span>
        </div>
        {step.params && Object.keys(step.params).length > 0 && (
          <div className="mt-0.5 space-y-0.5">
            {Object.entries(step.params).map(([k, v]) => (
              <div key={k} className="flex gap-1">
                <span className="text-slate-600 shrink-0">{k}:</span>
                <span className="text-slate-400 font-mono truncate">{typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 60)}</span>
              </div>
            ))}
          </div>
        )}
        {step.retries ? (
          <div className="text-yellow-400 mt-0.5">retry x{step.retries}</div>
        ) : null}
      </div>
    </div>
  )
}

export function StepDiff({ rawSteps, analyzedSteps, refinedSteps }: Props) {
  const [view, setView] = useState<View>('analyzed')

  const views: { key: View; label: string; steps: AutomationStep[] }[] = [
    { key: 'raw', label: `Raw (${rawSteps.length})`, steps: rawSteps },
    { key: 'analyzed', label: `Analyzed (${analyzedSteps.length})`, steps: analyzedSteps },
    ...(refinedSteps ? [{ key: 'refined' as View, label: `Refined (${refinedSteps.length})`, steps: refinedSteps }] : [])
  ]

  const activeView = views.find((v) => v.key === view) ?? views[1]

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-3">
        <GitCompare className="w-3.5 h-3.5 text-slate-500 mr-1" />
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              view === v.key
                ? 'bg-ghost-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {activeView.steps.map((step, idx) => (
          <StepCard key={step.id ?? idx} step={step} index={idx} />
        ))}
        {activeView.steps.length === 0 && (
          <div className="text-xs text-slate-500 p-4 text-center">No steps.</div>
        )}
      </div>
    </div>
  )
}
