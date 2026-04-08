import React from 'react'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import type { StepValidationResult } from './stepValidator'

interface StepValidationBadgeProps {
  result: StepValidationResult
  /** Compact variant for the collapsed step header */
  compact?: boolean
}

/**
 * Visual badge that reflects a step's validation state.
 * - `valid` → green checkmark "Ready"
 * - `incomplete` → amber triangle "Needs X"
 * - `invalid` → red "Invalid X"
 *
 * In compact mode the badge shows only the icon with an aria-label / title
 * so it fits next to the step header. The full label is used in the expanded
 * body so users get explicit guidance about what to fix.
 */
export function StepValidationBadge({ result, compact = false }: StepValidationBadgeProps) {
  const { level, label, messages } = result

  const Icon =
    level === 'valid' ? CheckCircle2 : level === 'incomplete' ? AlertTriangle : XCircle

  const iconColor =
    level === 'valid'
      ? 'text-emerald-400'
      : level === 'incomplete'
        ? 'text-amber-400'
        : 'text-red-400'

  const bg =
    level === 'valid'
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
      : level === 'incomplete'
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        : 'bg-red-500/10 border-red-500/30 text-red-300'

  const tooltip =
    messages.length > 0
      ? `${label}: ${messages.join(' · ')}`
      : label

  if (compact) {
    return (
      <span
        title={tooltip}
        aria-label={tooltip}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border ${bg}`}
      >
        <Icon className={`w-3 h-3 ${iconColor}`} />
      </span>
    )
  }

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 rounded border ${bg}`}
      role="status"
      aria-live="polite"
    >
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">{label}</p>
        {messages.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-[10px] opacity-90">
            {messages.slice(0, 4).map((m, idx) => (
              <li key={idx}>• {m}</li>
            ))}
            {messages.length > 4 && (
              <li className="italic opacity-70">+ {messages.length - 4} more…</li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
