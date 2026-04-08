/**
 * Phase 17 — SEA Platform Templates
 *
 * Dedicated dashboard that shows all supported South-East-Asia platforms
 * (Shopee, Lazada, TikTok Shop, Tiki, VNPay, Grab) with:
 *
 *   • Regional filter (VN / TH / ID / MY / PH / SG)
 *   • Kind filter (ecommerce / payment / social / ride-hail)
 *   • Per-platform card with recommended presets + archetypes + notes
 *   • One-click "Use template" button for every bundled workflow
 *
 * Creating a template drops the user in the Automation section with the
 * new workflow loaded — same UX as TemplatePickerModal.
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  MapPin,
  ShoppingBag,
  Store,
  Video,
  Package,
  CreditCard,
  Car,
  Globe2,
  AlertTriangle,
  PlayCircle,
  Sparkles,
  Fingerprint,
  ChevronRight,
  Loader2,
  CheckCircle2
} from 'lucide-react'
import type { SeaPlatform, WorkflowTemplate, NavSection } from '../../types'

const REGION_FLAG: Record<string, { label: string; flag: string }> = {
  VN: { label: 'Vietnam', flag: '🇻🇳' },
  TH: { label: 'Thailand', flag: '🇹🇭' },
  ID: { label: 'Indonesia', flag: '🇮🇩' },
  MY: { label: 'Malaysia', flag: '🇲🇾' },
  PH: { label: 'Philippines', flag: '🇵🇭' },
  SG: { label: 'Singapore', flag: '🇸🇬' }
}

const KIND_META: Record<string, { label: string; color: string }> = {
  ecommerce: { label: 'E-Commerce', color: 'bg-orange-500/20 text-orange-400' },
  payment:   { label: 'Payment',    color: 'bg-emerald-500/20 text-emerald-400' },
  social:    { label: 'Social',     color: 'bg-pink-500/20 text-pink-400' },
  'ride-hail': { label: 'Ride-Hail', color: 'bg-green-500/20 text-green-400' },
  delivery:  { label: 'Delivery',   color: 'bg-blue-500/20 text-blue-400' }
}

const ICON_MAP: Record<string, React.ElementType> = {
  ShoppingBag,
  Store,
  Video,
  Package,
  CreditCard,
  Car,
  Globe2,
  MapPin
}

interface SEAPlatformsProps {
  onNavigate?: (section: NavSection) => void
}

export function SEAPlatforms({ onNavigate }: SEAPlatformsProps) {
  const [platforms, setPlatforms] = useState<SeaPlatform[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [kindFilter, setKindFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [templates, setTemplates] = useState<Record<string, WorkflowTemplate[]>>({})
  const [creating, setCreating] = useState<string | null>(null)
  const [createdIds, setCreatedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      window.api.seaPlatforms.list(),
      window.api.seaPlatforms.regions()
    ])
      .then(([pls, rgs]) => {
        setPlatforms(pls)
        setRegions(rgs)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return platforms.filter((p) => {
      if (regionFilter !== 'all' && !p.regions.includes(regionFilter)) return false
      if (kindFilter !== 'all' && p.kind !== kindFilter) return false
      return true
    })
  }, [platforms, regionFilter, kindFilter])

  const toggleExpand = async (platform: SeaPlatform) => {
    if (expanded === platform.id) {
      setExpanded(null)
      return
    }
    setExpanded(platform.id)
    if (!templates[platform.id]) {
      const tpls = await window.api.seaPlatforms.templates(platform.id)
      setTemplates((prev) => ({ ...prev, [platform.id]: tpls }))
    }
  }

  const handleUseTemplate = async (templateId: string) => {
    setCreating(templateId)
    try {
      await window.api.templates.createFromTemplate(templateId)
      setCreatedIds((prev) => new Set(prev).add(templateId))
      // Navigate to automation builder so the user can run / edit the new workflow
      setTimeout(() => {
        onNavigate?.('automation')
      }, 500)
    } catch (err) {
      console.error('Failed to create from SEA template:', err)
    } finally {
      setCreating(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading SEA catalog...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">SEA Platforms</h1>
            <p className="text-xs text-slate-500">
              Pre-built templates for Shopee, Lazada, TikTok Shop, Tiki, VNPay, and Grab across Vietnam, Thailand, Indonesia, Malaysia, Philippines, and Singapore.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Region:</span>
          <button
            onClick={() => setRegionFilter('all')}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              regionFilter === 'all'
                ? 'bg-ghost-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            All
          </button>
          {regions.map((r) => (
            <button
              key={r}
              onClick={() => setRegionFilter(r)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                regionFilter === r
                  ? 'bg-ghost-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {REGION_FLAG[r]?.flag ?? '🏳️'} {r}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-slate-700" />

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Kind:</span>
          {['all', 'ecommerce', 'payment', 'social', 'ride-hail'].map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors capitalize ${
                kindFilter === k
                  ? 'bg-ghost-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {k === 'all' ? 'All' : KIND_META[k]?.label ?? k}
            </button>
          ))}
        </div>

        <div className="ml-auto text-xs text-slate-500">
          {filtered.length} of {platforms.length} platforms
        </div>
      </div>

      {/* Platform list */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-12">
            No platforms match the current filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((platform) => {
              const Icon = ICON_MAP[platform.icon] ?? Globe2
              const kindMeta = KIND_META[platform.kind] ?? { label: platform.kind, color: 'bg-slate-700 text-slate-300' }
              const isOpen = expanded === platform.id
              const platformTemplates = templates[platform.id] ?? []

              return (
                <div
                  key={platform.id}
                  className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden hover:border-slate-600/60 transition-colors"
                >
                  {/* Header row */}
                  <div className="flex items-start gap-3 p-4">
                    <div className={`mt-0.5 ${platform.accent}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-white">{platform.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${kindMeta.color}`}>
                          {kindMeta.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-2">
                        {platform.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {platform.regions.map((r) => (
                          <span
                            key={r}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/70 text-slate-300"
                          >
                            {REGION_FLAG[r]?.flag ?? '🏳️'} {r}
                          </span>
                        ))}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/70 text-slate-500">
                          {platform.currencies.join(' / ')}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleExpand(platform)}
                      className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 bg-slate-700/60 hover:bg-slate-700 transition-colors"
                    >
                      {platform.templateIds.length} templates
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      />
                    </button>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-slate-700/60 bg-slate-900/40 p-4 space-y-4">
                      {/* Recommended presets */}
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                          <Fingerprint className="w-3.5 h-3.5 text-ghost-400" />
                          Recommended Fingerprint Presets
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {platform.recommendedPresets.map((p) => (
                            <span
                              key={p}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-ghost-300 font-mono"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Recommended archetypes */}
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          Recommended Behaviour Archetypes
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {platform.recommendedArchetypes.map((a) => (
                            <span
                              key={a}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Anti-bot notes */}
                      {platform.notes.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            Anti-Bot Notes
                          </div>
                          <ul className="space-y-1">
                            {platform.notes.map((n, i) => (
                              <li key={i} className="text-[11px] text-slate-400 leading-relaxed pl-3 border-l border-slate-700">
                                {n}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Templates */}
                      <div>
                        <div className="text-xs font-semibold text-slate-300 mb-1.5">
                          Workflow Templates ({platformTemplates.length})
                        </div>
                        {platformTemplates.length === 0 ? (
                          <div className="text-[11px] text-slate-500">Loading templates...</div>
                        ) : (
                          <div className="space-y-1.5">
                            {platformTemplates.map((tpl) => {
                              const done = createdIds.has(tpl.id)
                              const busy = creating === tpl.id
                              return (
                                <div
                                  key={tpl.id}
                                  className="flex items-center gap-2 p-2 rounded-md bg-slate-800/70 border border-slate-700/40 hover:border-ghost-500/40 transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-white truncate">
                                      {tpl.name}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">
                                      {tpl.description}
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-slate-500 shrink-0">
                                    {tpl.steps.length} steps
                                  </span>
                                  <button
                                    onClick={() => handleUseTemplate(tpl.id)}
                                    disabled={busy || done}
                                    className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                                      done
                                        ? 'bg-emerald-900/40 text-emerald-400 cursor-default'
                                        : 'bg-ghost-600 hover:bg-ghost-700 text-white disabled:opacity-50'
                                    }`}
                                  >
                                    {done ? (
                                      <>
                                        <CheckCircle2 className="w-3 h-3" />
                                        Created
                                      </>
                                    ) : busy ? (
                                      <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Creating
                                      </>
                                    ) : (
                                      <>
                                        <PlayCircle className="w-3 h-3" />
                                        Use
                                      </>
                                    )}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
