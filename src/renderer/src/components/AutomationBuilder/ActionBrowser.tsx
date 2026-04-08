import React, { useState, useMemo } from 'react'
import {
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import type { AutomationActionType } from '../../types'
import { ACTION_META, ACTION_CATEGORIES } from './actionMetadata'
import { ActionCard } from './ActionCard'

interface ActionBrowserProps {
  onSelect: (action: AutomationActionType) => void
  onClose: () => void
}

export function ActionBrowser({ onSelect, onClose }: ActionBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(ACTION_CATEGORIES))
  )

  // Filter actions by search query
  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase()
    const result: Record<string, AutomationActionType[]> = {}

    Object.entries(ACTION_CATEGORIES).forEach(([category, actions]) => {
      const filtered = actions.filter((action) => {
        const meta = ACTION_META[action]
        const matchesLabel = meta.label.toLowerCase().includes(query)
        const matchesDescription = (meta.description || '').toLowerCase().includes(query)
        const matchesCategory = category.toLowerCase().includes(query)
        return matchesLabel || matchesDescription || matchesCategory
      })

      if (filtered.length > 0) {
        result[category] = filtered
      }
    })

    return result
  }, [searchQuery])

  const toggleCategory = (category: string) => {
    const newSet = new Set(expandedCategories)
    if (newSet.has(category)) {
      newSet.delete(category)
    } else {
      newSet.add(category)
    }
    setExpandedCategories(newSet)
  }

  // Auto-expand on search
  React.useEffect(() => {
    if (searchQuery) {
      setExpandedCategories(new Set(Object.keys(filteredCategories)))
    }
  }, [searchQuery, filteredCategories])

  const categoryOrder = [
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

  const orderedCategories = categoryOrder.filter((cat) => cat in filteredCategories)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-browser-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-ghost-400" />
            <h2
              id="action-browser-title"
              className="text-lg font-semibold text-white"
            >
              Add Action
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-slate-700/60 bg-slate-900/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actions... (e.g. click, extract, loop)"
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 pl-10 focus:outline-none focus:ring-2 focus:ring-ghost-500"
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {searchQuery
              ? `Found ${orderedCategories.reduce((sum, cat) => sum + (filteredCategories[cat]?.length ?? 0), 0)} action(s)`
              : 'Type to search, or browse by category below'}
          </p>
        </div>

        {/* Categories */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {orderedCategories.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400">No actions found matching "{searchQuery}"</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orderedCategories.map((category) => (
                <div key={category} className="border border-slate-700/50 rounded-lg overflow-hidden">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors"
                  >
                    {expandedCategories.has(category) ? (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-white flex-1 text-left">
                      {category}
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                      {filteredCategories[category]?.length ?? 0}
                    </span>
                  </button>

                  {/* Category actions */}
                  {expandedCategories.has(category) && (
                    <div className="bg-slate-900/30 border-t border-slate-700/30 px-4 py-2 space-y-2">
                      {(filteredCategories[category] ?? []).map((action) => (
                        <ActionCard
                          key={action}
                          action={action}
                          onSelect={() => {
                            onSelect(action)
                            onClose()
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700/60 bg-slate-900/80">
          <p className="text-xs text-slate-500">
            💡 Tip: Use the search bar to quickly find actions by name or description
          </p>
        </div>
      </div>
    </div>
  )
}
