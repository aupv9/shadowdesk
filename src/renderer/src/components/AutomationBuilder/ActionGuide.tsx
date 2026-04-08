import React from 'react'
import { HelpCircle, Lightbulb, AlertTriangle, BookOpen, X } from 'lucide-react'
import type { AutomationActionType } from '../../types'
import { ACTION_META } from './actionMetadata'

interface ActionGuideProps {
  action: AutomationActionType
  onClose: () => void
}

/**
 * Action-specific guide popover. Renders best-practice guidance sourced from
 * `actionMetadata.ts` — `whenToUse`, `example`, `commonMistakes`, and
 * `difficulty`. Gives users an in-context reference without having to leave
 * the step editor.
 */
export function ActionGuide({ action, onClose }: ActionGuideProps) {
  const meta = ACTION_META[action]
  if (!meta) return null

  const difficultyColor =
    meta.difficulty === 'Beginner'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : meta.difficulty === 'Easy'
        ? 'text-sky-400 bg-sky-500/10 border-sky-500/30'
        : meta.difficulty === 'Medium'
          ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
          : 'text-red-400 bg-red-500/10 border-red-500/30'

  const Icon = meta.icon

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-guide-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
          <div className="flex items-center gap-3 min-w-0">
            <Icon className={`w-5 h-5 ${meta.color} shrink-0`} />
            <div className="min-w-0">
              <h2
                id="action-guide-title"
                className="text-base font-semibold text-white truncate"
              >
                {meta.label}
              </h2>
              {meta.description && (
                <p className="text-xs text-slate-400 truncate">{meta.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Difficulty */}
          {meta.difficulty && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Difficulty:</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium ${difficultyColor}`}
              >
                {meta.difficulty}
              </span>
            </div>
          )}

          {/* When to use */}
          {meta.whenToUse && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-blue-300 font-medium mb-1">When to use</p>
                  <p className="text-xs text-blue-200">{meta.whenToUse}</p>
                </div>
              </div>
            </div>
          )}

          {/* Example */}
          {meta.example && (
            <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 font-medium mb-1">Example</p>
                  <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/60 border border-slate-700/40 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap">
                    {meta.example}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Common mistakes */}
          {meta.commonMistakes && meta.commonMistakes.length > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-amber-300 font-medium mb-1">
                    Common mistakes to avoid
                  </p>
                  <ul className="text-xs text-amber-200 space-y-1 list-disc list-inside">
                    {meta.commonMistakes.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Fallback when only the description is available */}
          {!meta.whenToUse && !meta.example && !meta.commonMistakes && (
            <div className="p-3 bg-slate-800/40 border border-slate-700/40 rounded-lg flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <p className="text-xs text-slate-400">
                No extra guidance available for this action yet. Configure the parameters and
                try running a dry-run to test it.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700/60 bg-slate-900/80">
          <p className="text-[11px] text-slate-500">
            Guidance sourced from the built-in action catalog.
          </p>
        </div>
      </div>
    </div>
  )
}
