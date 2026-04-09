import React from 'react'
import { Activity, Sparkles, Globe, Layers, Clock } from 'lucide-react'

/**
 * Compact stats strip + quick filter chips shown above the profile list.
 *
 * The strip doubles as a filter affordance: clicking a stat tile toggles
 * the matching quick filter (e.g. clicking "Running" filters to running
 * profiles only). The active filter is visually highlighted and a
 * second click clears it.
 */

export type QuickFilter =
  | 'all'
  | 'running'
  | 'warmed'
  | 'no-proxy'
  | 'never-used'

interface Stats {
  total: number
  running: number
  warmed: number
  noProxy: number
  neverUsed: number
}

interface Props {
  stats: Stats
  active: QuickFilter
  onChange: (f: QuickFilter) => void
}

interface Tile {
  key: QuickFilter
  label: string
  count: number
  icon: React.ReactNode
  color: string
}

export function ProfileStatsBar({ stats, active, onChange }: Props) {
  const tiles: Tile[] = [
    {
      key: 'all',
      label: 'Total',
      count: stats.total,
      icon: <Layers className="w-3.5 h-3.5" />,
      color: 'text-slate-300',
    },
    {
      key: 'running',
      label: 'Running',
      count: stats.running,
      icon: <Activity className="w-3.5 h-3.5" />,
      color: 'text-green-400',
    },
    {
      key: 'warmed',
      label: 'Warmed up',
      count: stats.warmed,
      icon: <Sparkles className="w-3.5 h-3.5" />,
      color: 'text-yellow-400',
    },
    {
      key: 'no-proxy',
      label: 'No proxy',
      count: stats.noProxy,
      icon: <Globe className="w-3.5 h-3.5" />,
      color: 'text-orange-400',
    },
    {
      key: 'never-used',
      label: 'Never used',
      count: stats.neverUsed,
      icon: <Clock className="w-3.5 h-3.5" />,
      color: 'text-blue-400',
    },
  ]

  return (
    <div className="px-6 pt-3 flex items-stretch gap-2 flex-wrap">
      {tiles.map((t) => {
        const isActive = active === t.key
        // The "all" tile just clears any active quick filter instead of
        // adding an explicit "all" filter — click-to-toggle works the
        // same as clicking the active tile again.
        const handleClick = () => {
          if (t.key === 'all') {
            onChange('all')
          } else {
            onChange(isActive ? 'all' : t.key)
          }
        }
        return (
          <button
            key={t.key}
            onClick={handleClick}
            className={`group flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
              isActive
                ? 'bg-slate-700/70 border-slate-500 ring-1 ring-ghost-500/50'
                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
            }`}
            title={t.key === 'all' ? 'Clear quick filter' : `Filter: ${t.label}`}
          >
            <span className={t.color}>{t.icon}</span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                {t.label}
              </span>
              <span className={`text-sm font-semibold ${t.color}`}>
                {t.count}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
