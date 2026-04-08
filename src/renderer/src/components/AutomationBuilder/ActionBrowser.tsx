import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Clock,
  Zap,
  LayoutList,
  AlignJustify,
  Filter
} from 'lucide-react'
import type { AutomationActionType } from '../../types'
import { ACTION_META, ACTION_CATEGORIES } from './actionMetadata'
import { ActionCard } from './ActionCard'

// ── Recently-used persistence ───────────────────────────────────────────────

const RECENT_ACTIONS_KEY = 'automation:recentActions'
const MAX_RECENT = 6

function getRecentActions(): AutomationActionType[] {
  try {
    const stored = localStorage.getItem(RECENT_ACTIONS_KEY)
    return stored ? (JSON.parse(stored) as AutomationActionType[]) : []
  } catch {
    return []
  }
}

function saveRecentAction(action: AutomationActionType): void {
  try {
    const recent = getRecentActions().filter((a) => a !== action)
    recent.unshift(action)
    localStorage.setItem(RECENT_ACTIONS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
  } catch {
    // ignore storage errors
  }
}

// ── Smart "Suggested Next" mapping ──────────────────────────────────────────

const SUGGESTED_AFTER: Partial<Record<AutomationActionType, AutomationActionType[]>> = {
  navigate:        ['waitForSelector', 'waitForNavigation', 'click', 'screenshot'],
  click:           ['waitForNavigation', 'waitForSelector', 'type', 'screenshot'],
  doubleClick:     ['type', 'waitForSelector', 'screenshot'],
  type:            ['click', 'keyPress', 'screenshot'],
  waitForSelector: ['click', 'extractText', 'type', 'hover'],
  waitForNavigation: ['waitForSelector', 'click', 'screenshot'],
  extractText:     ['assert', 'screenshot', 'httpRequest'],
  extractJson:     ['assert', 'httpRequest', 'evaluate'],
  screenshot:      ['navigate', 'click', 'extractText'],
  httpRequest:     ['extractJson', 'evaluate', 'assert'],
  evaluate:        ['screenshot', 'assert', 'extractText'],
  scroll:          ['click', 'waitForSelector', 'screenshot'],
  hover:           ['click', 'screenshot', 'waitForSelector'],
  keyPress:        ['waitForNavigation', 'waitForSelector', 'screenshot'],
  select:          ['click', 'waitForNavigation', 'screenshot'],
  conditional:     ['click', 'navigate', 'extractText'],
  loop:            ['navigate', 'click', 'extractText'],
  forEachRow:      ['navigate', 'type', 'click'],
  getCookies:      ['setCookies', 'evaluate', 'assert'],
  setCookies:      ['navigate', 'click', 'screenshot'],
}

// ── Types ────────────────────────────────────────────────────────────────────

type DifficultyFilter = 'All' | 'Beginner' | 'Easy' | 'Medium' | 'Advanced'

interface ActionBrowserProps {
  onSelect: (action: AutomationActionType) => void
  onClose: () => void
  /** The action type of the step immediately before this one (for smart suggestions) */
  previousActionType?: AutomationActionType
}

// ── Category order ────────────────────────────────────────────────────────────

const CATEGORY_ORDER = [
  '🔗 Navigation',
  '⏱️ Waiting & Visibility',
  '📸 Data Extraction',
  '🎯 Form Interactions',
  '🎨 Scroll & Movement',
  '📡 Network & Data',
  '🍪 Storage',
  '🔐 Security',
  '📑 Tabs & Windows',
  '🔄 Control Flow',
  '🎬 Workflow',
  '✅ Testing',
  '🖼️ Advanced DOM'
]

const DIFFICULTY_COLORS: Record<DifficultyFilter, string> = {
  All:      'bg-slate-700 text-slate-300 border-slate-600',
  Beginner: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Easy:     'bg-sky-500/20 text-sky-300 border-sky-500/40',
  Medium:   'bg-amber-500/20 text-amber-300 border-amber-500/40',
  Advanced: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
}

// ── Component ────────────────────────────────────────────────────────────────

export function ActionBrowser({ onSelect, onClose, previousActionType }: ActionBrowserProps) {
  const [searchQuery, setSearchQuery]         = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('All')
  const [compact, setCompact]                 = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORY_ORDER)
  )
  const [keyboardIndex, setKeyboardIndex]     = useState(-1)
  const [recentActions, setRecentActions]     = useState<AutomationActionType[]>(getRecentActions)

  const searchInputRef = useRef<HTMLInputElement>(null)

  const suggestions = previousActionType
    ? (SUGGESTED_AFTER[previousActionType] ?? []).filter((a) => a in ACTION_META)
    : []

  // ── Filtered category map ────────────────────────────────────────────────

  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase()
    const result: Record<string, AutomationActionType[]> = {}

    Object.entries(ACTION_CATEGORIES).forEach(([category, actions]) => {
      const filtered = (actions as AutomationActionType[]).filter((action) => {
        const meta = ACTION_META[action]
        if (difficultyFilter !== 'All' && meta.difficulty !== difficultyFilter) return false
        if (!query) return true
        return (
          meta.label.toLowerCase().includes(query) ||
          (meta.description ?? '').toLowerCase().includes(query) ||
          category.toLowerCase().includes(query)
        )
      })
      if (filtered.length > 0) result[category] = filtered
    })

    return result
  }, [searchQuery, difficultyFilter])

  const orderedCategories = CATEGORY_ORDER.filter((cat) => cat in filteredCategories)

  const totalVisible = useMemo(
    () => orderedCategories.reduce((sum, cat) => sum + (filteredCategories[cat]?.length ?? 0), 0),
    [orderedCategories, filteredCategories]
  )

  // Flat action list for keyboard navigation (category order, no dupes)
  const flatActions = useMemo<AutomationActionType[]>(() => {
    const result: AutomationActionType[] = []
    orderedCategories.forEach((cat) => {
      if (expandedCategories.has(cat)) {
        result.push(...(filteredCategories[cat] ?? []))
      }
    })
    return result
  }, [orderedCategories, filteredCategories, expandedCategories])

  // Auto-expand all matching categories when searching
  useEffect(() => {
    if (searchQuery) {
      setExpandedCategories(new Set(Object.keys(filteredCategories)))
    }
  }, [searchQuery, filteredCategories])

  // Reset keyboard index when filters change
  useEffect(() => {
    setKeyboardIndex(-1)
  }, [searchQuery, difficultyFilter])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelect = useCallback((action: AutomationActionType) => {
    saveRecentAction(action)
    setRecentActions(getRecentActions())
    onSelect(action)
    onClose()
  }, [onSelect, onClose])

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      next.has(category) ? next.delete(category) : next.add(category)
      return next
    })
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setKeyboardIndex((prev) => Math.min(prev + 1, flatActions.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setKeyboardIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && keyboardIndex >= 0) {
        e.preventDefault()
        const selected = flatActions[keyboardIndex]
        if (selected) handleSelect(selected)
      }
    },
    [flatActions, keyboardIndex, onClose, handleSelect]
  )

  // ── Render ────────────────────────────────────────────────────────────────

  const showQuickAccess = !searchQuery && difficultyFilter === 'All'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-browser-title"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-ghost-400" />
            <h2 id="action-browser-title" className="text-lg font-semibold text-white">
              Add Action
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Compact / detailed toggle */}
            <button
              onClick={() => setCompact((v) => !v)}
              title={compact ? 'Switch to detailed view' : 'Switch to compact view'}
              className={`p-1.5 rounded-lg transition-colors border ${
                compact
                  ? 'bg-ghost-500/20 text-ghost-400 border-ghost-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 border-transparent'
              }`}
              aria-pressed={compact}
            >
              {compact
                ? <AlignJustify className="w-4 h-4" />
                : <LayoutList className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Close action browser"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Search + difficulty filter ──────────────────────────────────── */}
        <div className="px-6 py-3 border-b border-slate-700/60 bg-slate-900/50 space-y-2.5">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actions… (e.g. click, extract, loop)"
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 pl-10 pr-8 focus:outline-none focus:ring-2 focus:ring-ghost-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Difficulty chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            {(['All', 'Beginner', 'Easy', 'Medium', 'Advanced'] as DifficultyFilter[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficultyFilter(d)}
                className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                  difficultyFilter === d
                    ? DIFFICULTY_COLORS[d]
                    : 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                {d}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-slate-500">
              {searchQuery || difficultyFilter !== 'All'
                ? `${totalVisible} action${totalVisible !== 1 ? 's' : ''}`
                : `${Object.values(ACTION_CATEGORIES).flat().length} total`}
            </span>
          </div>
        </div>

        {/* ── Scrollable content ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3">

          {/* Recently Used */}
          {showQuickAccess && recentActions.length > 0 && (
            <section aria-label="Recently used actions">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Recently Used
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentActions.map((action) => {
                  const meta = ACTION_META[action]
                  if (!meta) return null
                  const Icon = meta.icon
                  return (
                    <button
                      key={action}
                      onClick={() => handleSelect(action)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-ghost-500/50 rounded-lg text-xs text-white transition-colors"
                    >
                      <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      {meta.label}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 border-t border-slate-800" />
            </section>
          )}

          {/* Smart Suggestions */}
          {showQuickAccess && suggestions.length > 0 && (
            <section aria-label="Suggested next actions">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="w-3.5 h-3.5 text-ghost-400" />
                <span className="text-xs font-semibold text-ghost-400 uppercase tracking-wide">
                  Suggested Next
                </span>
                <span className="text-[11px] text-slate-600">
                  after {ACTION_META[previousActionType!]?.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((action) => {
                  const meta = ACTION_META[action]
                  if (!meta) return null
                  const Icon = meta.icon
                  return (
                    <button
                      key={action}
                      onClick={() => handleSelect(action)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-ghost-500/10 hover:bg-ghost-500/20 border border-ghost-500/30 hover:border-ghost-500/60 rounded-lg text-xs text-ghost-300 transition-colors"
                    >
                      <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      {meta.label}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 border-t border-slate-800" />
            </section>
          )}

          {/* Category list */}
          {orderedCategories.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-400 text-sm">No actions found for "{searchQuery}"</p>
              {difficultyFilter !== 'All' && (
                <button
                  onClick={() => setDifficultyFilter('All')}
                  className="mt-2 text-xs text-ghost-400 hover:text-ghost-300 transition-colors"
                >
                  Clear difficulty filter
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {orderedCategories.map((category) => {
                const categoryActions = filteredCategories[category] ?? []
                return (
                  <div key={category} className="border border-slate-700/50 rounded-lg overflow-hidden">
                    {/* Category header */}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/50 transition-colors"
                      aria-expanded={expandedCategories.has(category)}
                    >
                      {expandedCategories.has(category)
                        ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
                      <span className="text-sm font-semibold text-white flex-1 text-left">
                        {category}
                      </span>
                      <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded tabular-nums">
                        {categoryActions.length}
                      </span>
                    </button>

                    {/* Actions inside category */}
                    {expandedCategories.has(category) && (
                      <div className={`bg-slate-900/30 border-t border-slate-700/30 px-3 py-2 ${compact ? 'space-y-1' : 'space-y-2'}`}>
                        {categoryActions.map((action) => {
                          const flatIdx = flatActions.indexOf(action)
                          return (
                            <ActionCard
                              key={action}
                              action={action}
                              onSelect={() => handleSelect(action)}
                              compact={compact}
                              searchQuery={searchQuery}
                              isHighlighted={keyboardIndex === flatIdx && flatIdx !== -1}
                            />
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="px-6 py-2.5 border-t border-slate-700/60 bg-slate-900/80 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            <kbd className="font-mono">↑↓</kbd> Navigate &nbsp;·&nbsp;
            <kbd className="font-mono">↵</kbd> Select &nbsp;·&nbsp;
            <kbd className="font-mono">Esc</kbd> Close
          </p>
          <p className="text-[11px] text-slate-500">
            {Object.values(ACTION_CATEGORIES).flat().length} actions · 13 categories
          </p>
        </div>
      </div>
    </div>
  )
}
