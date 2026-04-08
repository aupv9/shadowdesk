import React, { useState } from 'react'
import { ChevronDown, HelpCircle, Target } from 'lucide-react'
import type { AutomationActionType } from '../../types'
import { ACTION_META } from './actionMetadata'

interface ActionCardProps {
  action: AutomationActionType
  onSelect: () => void
}

export function ActionCard({ action, onSelect }: ActionCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const meta = ACTION_META[action]
  const Icon = meta.icon

  return (
    <button
      onClick={onSelect}
      className="w-full group text-left p-3 rounded-lg border border-slate-700/50 hover:border-ghost-500/50 hover:bg-slate-800/50 transition-all"
    >
      {/* Main content */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="shrink-0 w-8 h-8 rounded-lg border border-slate-700/50 flex items-center justify-center mt-0.5">
          <Icon className={`w-4 h-4 ${meta.color}`} />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-sm font-semibold text-white truncate">
              {meta.label}
            </h4>
            {meta.difficulty && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                  getDifficultyColors(meta.difficulty)
                }`}
              >
                {meta.difficulty}
              </span>
            )}
          </div>

          {/* Description */}
          {meta.description && (
            <p className="text-xs text-slate-400 mb-2 line-clamp-2">
              {meta.description}
            </p>
          )}

          {/* Expandable details */}
          <button
            onClick={(e) => {
              e.preventDefault()
              setShowDetails(!showDetails)
            }}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <HelpCircle className="w-3 h-3" />
            {showDetails ? 'Hide' : 'Show'} details
            <ChevronDown
              className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Expandable details */}
      {showDetails && (
        <div className="mt-2 pt-2 border-t border-slate-700/30 space-y-2 text-[11px] text-slate-400">
          {meta.whenToUse && (
            <div>
              <div className="flex items-start gap-2 mb-0.5">
                <Target className="w-3 h-3 shrink-0 mt-0.5 text-slate-500" />
                <div>
                  <p className="text-slate-300 font-medium">When to use:</p>
                  <p>{meta.whenToUse}</p>
                </div>
              </div>
            </div>
          )}

          {meta.example && (
            <div>
              <p className="text-slate-300 font-medium mb-0.5">Example:</p>
              <code className="bg-slate-800 px-2 py-1 rounded border border-slate-700 block text-[10px] font-mono text-slate-300 whitespace-pre-wrap break-all">
                {meta.example}
              </code>
            </div>
          )}

          {meta.commonMistakes && (
            <div>
              <p className="text-slate-300 font-medium mb-0.5">⚠️ Common mistakes:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                {meta.commonMistakes.map((mistake, idx) => (
                  <li key={idx} className="text-[10px]">
                    {mistake}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </button>
  )
}

function getDifficultyColors(difficulty: string): string {
  switch (difficulty) {
    case 'Beginner':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    case 'Easy':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30'
    case 'Medium':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    case 'Advanced':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    default:
      return 'bg-slate-500/15 text-slate-300 border-slate-500/30'
  }
}
