import React from 'react'
import { Check, X, Wand2, Shield, RefreshCw, Tag, AlertTriangle } from 'lucide-react'

interface RefinementSuggestion {
  stepId: string
  type: 'selector-heal' | 'step-fix' | 'add-retry' | 'add-error-handler' | 'add-wait' | 'parameterize'
  before: Record<string, any>
  after: Record<string, any>
  reason: string
  applied: boolean
}

interface Props {
  suggestions: RefinementSuggestion[]
  accepted: Set<string>
  onAccept: (stepId: string, type: string) => void
  onReject: (stepId: string, type: string) => void
  aiNotes?: string
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  'selector-heal':   <Wand2 className="w-3.5 h-3.5 text-purple-400" />,
  'step-fix':        <Tag className="w-3.5 h-3.5 text-blue-400" />,
  'add-retry':       <RefreshCw className="w-3.5 h-3.5 text-yellow-400" />,
  'add-error-handler': <Shield className="w-3.5 h-3.5 text-orange-400" />,
  'add-wait':        <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />,
  'parameterize':    <Tag className="w-3.5 h-3.5 text-ghost-400" />,
}

const TYPE_LABEL: Record<string, string> = {
  'selector-heal': 'Selector healed',
  'step-fix': 'Step labeled',
  'add-retry': 'Retry added',
  'add-error-handler': 'Error handler',
  'add-wait': 'Wait inserted',
  'parameterize': 'Parameterized',
}

export function RefinementPanel({ suggestions, accepted, onAccept, onReject, aiNotes }: Props) {
  if (suggestions.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic p-2">No AI suggestions generated.</div>
    )
  }

  return (
    <div className="space-y-1.5">
      {aiNotes && (
        <div className="text-xs text-slate-400 italic mb-3 p-2 bg-slate-800/40 rounded border border-slate-700/30">
          {aiNotes}
        </div>
      )}
      {suggestions.map((s, idx) => {
        const key = `${s.stepId}:${s.type}`
        const isAccepted = accepted.has(key)

        return (
          <div
            key={idx}
            className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${
              isAccepted
                ? 'border-green-500/20 bg-green-500/5'
                : 'border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/60'
            }`}
          >
            {/* Type icon */}
            <div className="shrink-0 mt-0.5">{TYPE_ICON[s.type] ?? <Wand2 className="w-3.5 h-3.5" />}</div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-300">{TYPE_LABEL[s.type] ?? s.type}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.reason}</p>
            </div>

            {/* Accept / Reject */}
            <div className="flex items-center gap-1 shrink-0">
              {isAccepted ? (
                <span className="text-green-400 flex items-center gap-1 text-xs"><Check className="w-3 h-3" /></span>
              ) : (
                <>
                  <button
                    onClick={() => onAccept(s.stepId, s.type)}
                    className="p-1 rounded hover:bg-green-500/10 text-green-400 transition-colors"
                    title="Accept suggestion"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onReject(s.stepId, s.type)}
                    className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                    title="Reject suggestion"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
