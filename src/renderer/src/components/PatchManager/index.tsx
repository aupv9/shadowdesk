import React, { useEffect, useState } from 'react'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Code2,
  Terminal,
  Cpu,
  ChevronDown,
  ChevronRight,
  Zap,
  Lock
} from 'lucide-react'
import type { ChromiumPatch, ChromiumPatchStatus, ChromiumPatchCategory } from '../../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVEL_META: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
  'js-shim':        { label: 'JS Shim',        color: 'text-green-400 bg-green-400/10',  icon: Code2,    description: 'Implemented as JavaScript override — active for all profiles' },
  'cdp-override':   { label: 'CDP Override',   color: 'text-blue-400 bg-blue-400/10',   icon: Terminal, description: 'Applied via Chrome DevTools Protocol — active for all profiles' },
  'requires-build': { label: 'Custom Build',   color: 'text-amber-400 bg-amber-400/10', icon: Cpu,      description: 'Requires a custom Chromium build with C++ patches — planned for Phase 8+' }
}

const IMPACT_COLOR: Record<string, string> = {
  low:    'text-slate-400',
  medium: 'text-yellow-400',
  high:   'text-red-400'
}

const CATEGORY_LABEL: Record<ChromiumPatchCategory, string> = {
  fingerprint: 'Fingerprint',
  automation:  'Automation',
  timing:      'Timing',
  network:     'Network',
  gpu:         'GPU',
  locale:      'Locale'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PatchManager() {
  const [status, setStatus] = useState<ChromiumPatchStatus | null>(null)
  const [loading, setLoading]   = useState(true)
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set(['js-shim', 'cdp-override']))
  const [filterCategory, setFilterCategory] = useState<string>('all')

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    setLoading(true)
    try {
      const s = await window.api.patches.status()
      setStatus(s)
    } finally {
      setLoading(false)
    }
  }

  function toggleLevel(level: string) {
    setExpandedLevels(prev => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading patch status...</div>
      </div>
    )
  }

  if (!status) return null

  const categories = ['all', 'fingerprint', 'automation', 'timing', 'network', 'gpu', 'locale'] as const

  const filtered = filterCategory === 'all'
    ? status.patches
    : status.patches.filter(p => p.category === filterCategory)

  const byLevel = {
    'js-shim':        filtered.filter(p => p.level === 'js-shim'),
    'cdp-override':   filtered.filter(p => p.level === 'cdp-override'),
    'requires-build': filtered.filter(p => p.level === 'requires-build')
  }

  const activeCount   = status.active
  const totalCount    = status.total
  const coveragePct   = Math.round((activeCount / totalCount) * 100)

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-ghost-400" />
          Chromium Patch Manager
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Phase 8 — Anti-detect patches applied at JS, CDP, and C++ layers
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span className="text-xs text-slate-400">Active Patches</span>
          </div>
          <div className="text-2xl font-bold text-white">{activeCount}</div>
          <div className="text-xs text-slate-500 mt-0.5">of {totalCount} total</div>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Code2 className="w-4 h-4 text-green-400" />
            <span className="text-xs text-slate-400">JS Shims</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{status.jsShims}</div>
          <div className="text-xs text-slate-500 mt-0.5">active now</div>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400">CDP Overrides</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{status.cdpOverrides}</div>
          <div className="text-xs text-slate-500 mt-0.5">active now</div>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-400">Custom Build</span>
          </div>
          <div className="text-2xl font-bold text-amber-400">{status.requiresBuild}</div>
          <div className="text-xs text-slate-500 mt-0.5">planned</div>
        </div>
      </div>

      {/* Coverage Bar */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300 font-medium">Patch Coverage</span>
          <span className="text-sm font-bold text-white">{coveragePct}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-ghost-500 rounded-full transition-all"
            style={{ width: `${coveragePct}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {activeCount} patches active. {status.requiresBuild} more require a custom Chromium build (Phase 8+ roadmap).
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterCategory === cat
                ? 'bg-ghost-600/20 text-ghost-400 border border-ghost-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}
          >
            {cat === 'all' ? 'All Categories' : CATEGORY_LABEL[cat as ChromiumPatchCategory]}
          </button>
        ))}
      </div>

      {/* Patch Groups */}
      {(['js-shim', 'cdp-override', 'requires-build'] as const).map(level => {
        const patches   = byLevel[level]
        if (patches.length === 0) return null
        const meta      = LEVEL_META[level]
        const Icon      = meta.icon
        const expanded  = expandedLevels.has(level)

        return (
          <div key={level} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            {/* Group Header */}
            <button
              onClick={() => toggleLevel(level)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-750 transition-colors"
            >
              {expanded
                ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              }
              <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${meta.color}`}>
                <Icon className="w-3.5 h-3.5" />
                {meta.label}
              </span>
              <span className="text-sm text-slate-300 font-medium">{patches.length} patches</span>
              {level === 'requires-build' && (
                <span className="ml-auto flex items-center gap-1 text-xs text-amber-400">
                  <Lock className="w-3 h-3" />
                  Requires custom Chromium
                </span>
              )}
              {level !== 'requires-build' && (
                <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
                  <Zap className="w-3 h-3" />
                  Active
                </span>
              )}
            </button>

            {/* Group Description */}
            {expanded && (
              <div className="px-5 pb-1">
                <p className="text-xs text-slate-500 mb-3">{meta.description}</p>
              </div>
            )}

            {/* Patch List */}
            {expanded && (
              <div className="divide-y divide-slate-700/50">
                {patches.map(patch => (
                  <PatchRow key={patch.id} patch={patch} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── PatchRow ──────────────────────────────────────────────────────────────────

function PatchRow({ patch }: { patch: ChromiumPatch }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="px-5 py-3">
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Status indicator */}
        <div className="mt-0.5 shrink-0">
          {patch.active
            ? <ShieldCheck className="w-4 h-4 text-green-400" />
            : <ShieldAlert className="w-4 h-4 text-amber-400" />
          }
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">{patch.name}</span>
            <span className={`text-[10px] font-medium ${IMPACT_COLOR[patch.impact]}`}>
              {patch.impact.toUpperCase()} impact
            </span>
            <span className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">
              {CATEGORY_LABEL[patch.category]}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{patch.description}</p>

          {expanded && patch.technicalNote && (
            <div className="mt-2 p-2 bg-slate-900/50 rounded text-xs text-slate-400 font-mono border border-slate-700">
              {patch.technicalNote}
            </div>
          )}
        </div>

        {/* Expand toggle */}
        {patch.technicalNote && (
          <div className="shrink-0 mt-0.5">
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
              : <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            }
          </div>
        )}
      </div>
    </div>
  )
}
