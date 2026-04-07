/**
 * Phase 15.A — Workflow Marketplace
 * Browse and one-click install community automation workflows.
 */

import React, { useEffect, useState } from 'react'
import { Search, Download, Star, Tag, CheckCircle2, Loader2, Store } from 'lucide-react'
import { useMarketplaceStore } from '../../stores/marketplaceStore'
import type { MarketplaceCategory, MarketplaceWorkflow } from '../../types'

const CATEGORIES: { key: MarketplaceCategory | 'all'; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'social',    label: 'Social' },
  { key: 'ecommerce', label: 'E-Commerce' },
  { key: 'scraping',  label: 'Scraping' },
  { key: 'testing',   label: 'Testing' },
  { key: 'utility',   label: 'Utility' },
  { key: 'finance',   label: 'Finance' }
]

function WorkflowCard({
  item,
  installed,
  onInstall
}: {
  item: MarketplaceWorkflow
  installed: boolean
  onInstall: (id: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(installed)

  const handleInstall = async () => {
    if (done || busy) return
    setBusy(true)
    try {
      await onInstall(item.id)
      setDone(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{item.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">by {item.author} · v{item.version}</p>
        </div>
        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 capitalize">
          {item.category}
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3 text-amber-400" />{item.stars.toFixed(1)}
        </span>
        <span className="flex items-center gap-1">
          <Download className="w-3 h-3" />{item.downloads.toLocaleString()}
        </span>
        <div className="flex flex-wrap gap-1 ml-auto">
          {item.tags.slice(0, 3).map((t) => (
            <span key={t} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
              <Tag className="w-2.5 h-2.5" />{t}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={handleInstall}
        disabled={done || busy}
        className={`mt-1 text-xs flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-colors ${
          done
            ? 'bg-emerald-900/40 text-emerald-400 cursor-default'
            : 'btn-primary'
        }`}
      >
        {busy  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Installing…</> :
         done  ? <><CheckCircle2 className="w-3.5 h-3.5" />Installed</> :
                 <><Download className="w-3.5 h-3.5" />Install</>}
      </button>
    </div>
  )
}

export function Marketplace() {
  const { items, loading, error, fetch, install, installedIds } = useMarketplaceStore()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<MarketplaceCategory | 'all'>('all')

  useEffect(() => {
    fetch(category === 'all' ? { q: q || undefined } : { category, q: q || undefined })
  }, [category, q])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800">
        <Store className="w-5 h-5 text-indigo-400" />
        <h2 className="text-base font-semibold text-white">Workflow Marketplace</h2>
        <p className="text-xs text-slate-500 ml-2">Browse and install community automation workflows</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-800">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            className="input-field pl-9 text-xs"
            placeholder="Search workflows…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                category === c.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error && (
          <p className="text-sm text-red-400 mb-4">{error}</p>
        )}
        {loading && items.length === 0 ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading marketplace…
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No workflows found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((item) => (
              <WorkflowCard
                key={item.id}
                item={item}
                installed={installedIds.has(item.id)}
                onInstall={install}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
