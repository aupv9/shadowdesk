import React, { useMemo, useState } from 'react'
import {
  Bot,
  ChevronRight,
  Search,
  X,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  Square
} from 'lucide-react'
import type { AutomationWorkflow } from '../../types'

type SortMode = 'recent' | 'name' | 'steps'

interface WorkflowSidebarProps {
  workflows: AutomationWorkflow[]
  selectedId: string | null
  loading: boolean
  /** Map of workflowId → { status, timestamp } for latest run (optional) */
  lastRuns?: Record<string, { status: 'completed' | 'failed' | 'stopped'; at: string }>
  onSelect: (id: string) => void
}

/**
 * Enhanced workflow sidebar with search, sort, and last-run status indicators.
 *
 * Extracted from the monolithic AutomationBuilder/index.tsx so the list pane
 * can evolve independently (search, sort, badges) without touching the main
 * editor layout.
 */
export function WorkflowSidebar({
  workflows,
  selectedId,
  loading,
  lastRuns,
  onSelect
}: WorkflowSidebarProps) {
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('recent')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? workflows.filter(
          (w) =>
            w.name.toLowerCase().includes(q) ||
            (w.description ?? '').toLowerCase().includes(q)
        )
      : workflows
    const sorted = [...base]
    switch (sortMode) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'steps':
        sorted.sort((a, b) => b.steps.length - a.steps.length)
        break
      case 'recent':
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
    }
    return sorted
  }, [workflows, query, sortMode])

  const cycleSort = () => {
    setSortMode((m) => (m === 'recent' ? 'name' : m === 'name' ? 'steps' : 'recent'))
  }

  const sortLabel: Record<SortMode, string> = {
    recent: 'Recent',
    name: 'Name',
    steps: 'Steps'
  }

  return (
    <div className="w-64 border-r border-slate-800 flex flex-col overflow-hidden">
      {/* Search + Sort controls */}
      <div className="p-3 border-b border-slate-800 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workflows…"
            className="w-full bg-slate-800/60 border border-slate-700 text-slate-200 text-xs rounded pl-8 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500 placeholder-slate-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>
            {filtered.length} of {workflows.length}
          </span>
          <button
            onClick={cycleSort}
            className="flex items-center gap-1 hover:text-slate-300 transition-colors"
            title="Cycle sort order"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortLabel[sortMode]}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-slate-500">Loading…</div>
        ) : workflows.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">
            No workflows yet. Create one or pick a template.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">
            No workflows match "{query}".
          </div>
        ) : (
          <div className="py-2">
            {filtered.map((w) => {
              const last = lastRuns?.[w.id]
              const isSelected = selectedId === w.id
              return (
                <button
                  key={w.id}
                  onClick={() => onSelect(w.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-ghost-600/10 text-ghost-400 border-r-2 border-ghost-500'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Bot className="w-4 h-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{w.name}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                      <span>
                        {w.steps.length} step{w.steps.length !== 1 ? 's' : ''}
                      </span>
                      {last && (
                        <>
                          <span className="text-slate-700">•</span>
                          <LastRunBadge status={last.status} />
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 shrink-0 opacity-50" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function LastRunBadge({ status }: { status: 'completed' | 'failed' | 'stopped' }) {
  if (status === 'completed') {
    return (
      <span className="flex items-center gap-0.5 text-green-400">
        <CheckCircle className="w-2.5 h-2.5" />
        ok
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="flex items-center gap-0.5 text-red-400">
        <XCircle className="w-2.5 h-2.5" />
        fail
      </span>
    )
  }
  return (
    <span className="flex items-center gap-0.5 text-yellow-400">
      <Square className="w-2.5 h-2.5" />
      stop
    </span>
  )
}

