import React from 'react'
import { ChevronsDown, ChevronsUp, Eye, EyeOff, Filter } from 'lucide-react'

export type StepFilterMode = 'all' | 'invalid' | 'incomplete'

interface StepsToolbarProps {
  stepCount: number
  invalidCount: number
  incompleteCount: number
  allExpanded: boolean
  filterMode: StepFilterMode
  onExpandAll: () => void
  onCollapseAll: () => void
  onFilterChange: (mode: StepFilterMode) => void
}

/**
 * Toolbar shown above the list of steps in the Automation Builder.
 *
 * Provides bulk actions (expand/collapse all) and a quick filter to focus on
 * steps that still need attention — useful for workflows with dozens of steps
 * where the user has left some fields blank.
 */
export function StepsToolbar({
  stepCount,
  invalidCount,
  incompleteCount,
  allExpanded,
  filterMode,
  onExpandAll,
  onCollapseAll,
  onFilterChange
}: StepsToolbarProps) {
  if (stepCount === 0) return null

  return (
    <div className="mb-3 flex items-center gap-2 flex-wrap">
      <div className="text-xs text-slate-500 mr-1">
        {stepCount} step{stepCount === 1 ? '' : 's'}
      </div>

      <div className="h-4 w-px bg-slate-700/60" />

      {/* Expand / collapse bulk toggle */}
      {allExpanded ? (
        <button
          onClick={onCollapseAll}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded transition-colors"
          title="Collapse every step"
        >
          <ChevronsUp className="w-3 h-3" />
          Collapse all
        </button>
      ) : (
        <button
          onClick={onExpandAll}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded transition-colors"
          title="Expand every step to review its configuration"
        >
          <ChevronsDown className="w-3 h-3" />
          Expand all
        </button>
      )}

      <div className="h-4 w-px bg-slate-700/60" />

      {/* Filter chips */}
      <div className="flex items-center gap-1 text-[11px]">
        <Filter className="w-3 h-3 text-slate-500" />
        <FilterChip
          active={filterMode === 'all'}
          label={`All (${stepCount})`}
          onClick={() => onFilterChange('all')}
        />
        <FilterChip
          active={filterMode === 'incomplete'}
          label={`Needs attention (${incompleteCount + invalidCount})`}
          tone={incompleteCount + invalidCount > 0 ? 'warn' : 'muted'}
          onClick={() =>
            onFilterChange(filterMode === 'incomplete' ? 'all' : 'incomplete')
          }
          disabled={incompleteCount + invalidCount === 0}
        />
        {invalidCount > 0 && (
          <FilterChip
            active={filterMode === 'invalid'}
            label={`Errors (${invalidCount})`}
            tone="error"
            onClick={() => onFilterChange(filterMode === 'invalid' ? 'all' : 'invalid')}
          />
        )}
      </div>

      {filterMode !== 'all' && (
        <button
          onClick={() => onFilterChange('all')}
          className="ml-auto flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          title="Clear filter"
        >
          {filterMode === 'invalid' || filterMode === 'incomplete' ? (
            <EyeOff className="w-3 h-3" />
          ) : (
            <Eye className="w-3 h-3" />
          )}
          Show all
        </button>
      )}
    </div>
  )
}

function FilterChip({
  active,
  label,
  tone = 'default',
  disabled,
  onClick
}: {
  active: boolean
  label: string
  tone?: 'default' | 'warn' | 'error' | 'muted'
  disabled?: boolean
  onClick: () => void
}) {
  const baseClasses =
    'px-2 py-0.5 rounded border transition-colors whitespace-nowrap disabled:cursor-not-allowed'
  let cls = baseClasses
  if (disabled) {
    cls += ' border-slate-800 text-slate-600'
  } else if (active) {
    if (tone === 'error') {
      cls += ' bg-red-500/15 border-red-500/30 text-red-300'
    } else if (tone === 'warn') {
      cls += ' bg-amber-500/15 border-amber-500/30 text-amber-300'
    } else {
      cls += ' bg-ghost-600/15 border-ghost-500/30 text-ghost-300'
    }
  } else {
    if (tone === 'muted') {
      cls += ' border-slate-800 text-slate-600 hover:text-slate-500'
    } else if (tone === 'error') {
      cls += ' border-red-500/20 text-red-400 hover:bg-red-500/10'
    } else if (tone === 'warn') {
      cls += ' border-amber-500/20 text-amber-400 hover:bg-amber-500/10'
    } else {
      cls += ' border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }
  }

  return (
    <button onClick={onClick} className={cls} disabled={disabled}>
      {label}
    </button>
  )
}
