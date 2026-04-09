/**
 * Phase 13.C — Reusable empty-state component.
 *
 * Renders a centered illustration, heading, description, and optional
 * call-to-action button when a list has no items to display.
 */

import React from 'react'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  /** Lucide icon to display as the illustration. */
  icon: LucideIcon
  /** Primary heading text. */
  title: string
  /** Secondary descriptive text. */
  description?: string
  /** Label for the primary action button. */
  actionLabel?: string
  /** Callback when the action button is clicked. */
  onAction?: () => void
  /** Additional CSS classes on the root div. */
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center h-60 text-center px-8 animate-in fade-in duration-500 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center mb-4 ring-1 ring-slate-700/50 shadow-lg">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>
      <p className="text-slate-200 font-semibold text-base mb-2">{title}</p>
      {description && (
        <p className="text-slate-400 text-sm mb-6 max-w-xs">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn-primary text-sm flex items-center gap-2 px-4 py-2 hover:scale-105 transition-transform duration-200"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
