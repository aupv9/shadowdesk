import React, { useState } from 'react'
import {
  Filter, X, Monitor, Smartphone, Tablet, Globe2, Calendar,
  ChevronDown, RotateCcw
} from 'lucide-react'

// ── Filter types ────────────────────────────────────────────────────────────

export type OsPlatformFilter = 'all' | 'windows' | 'macos' | 'linux' | 'android' | 'ios'
export type ProxyFilter = 'all' | 'has-proxy' | 'no-proxy' | 'http' | 'socks5'
export type DateRangeFilter = 'all' | 'today' | 'week' | 'month' | 'older'

export interface AdvancedFilterState {
  platform: OsPlatformFilter
  proxy: ProxyFilter
  dateRange: DateRangeFilter
  presetSearch: string
}

export const DEFAULT_FILTERS: AdvancedFilterState = {
  platform: 'all',
  proxy: 'all',
  dateRange: 'all',
  presetSearch: ''
}

export function isFiltersActive(f: AdvancedFilterState): boolean {
  return f.platform !== 'all' || f.proxy !== 'all' || f.dateRange !== 'all' || f.presetSearch !== ''
}

export function countActiveFilters(f: AdvancedFilterState): number {
  let n = 0
  if (f.platform !== 'all') n++
  if (f.proxy !== 'all') n++
  if (f.dateRange !== 'all') n++
  if (f.presetSearch !== '') n++
  return n
}

// ── Platform matching ────────────────────────────────────────────────────────

const PLATFORM_MAP: Record<OsPlatformFilter, string[]> = {
  all: [],
  windows: ['Win32'],
  macos: ['MacIntel'],
  linux: ['Linux x86_64', 'Linux armv8l'],
  android: ['Linux armv8l'],
  ios: ['iPhone', 'iPad']
}

export function matchesPlatformFilter(osPlatform: string, preset: string, filter: OsPlatformFilter): boolean {
  if (filter === 'all') return true
  // For android, check preset name since Linux armv8l is shared
  if (filter === 'android') return preset.startsWith('android-')
  if (filter === 'linux') return (osPlatform === 'Linux x86_64' || osPlatform === 'Linux armv8l') && !preset.startsWith('android-')
  const platforms = PLATFORM_MAP[filter]
  return platforms.includes(osPlatform)
}

// ── Date range matching ──────────────────────────────────────────────────────

export function matchesDateRange(dateStr: string | null | undefined, filter: DateRangeFilter): boolean {
  if (filter === 'all') return true
  if (!dateStr) return filter === 'older' // no date = consider as old
  const date = new Date(dateStr).getTime()
  const now = Date.now()
  const day = 86400000
  switch (filter) {
    case 'today': return now - date < day
    case 'week':  return now - date < 7 * day
    case 'month': return now - date < 30 * day
    case 'older': return now - date >= 30 * day
    default: return true
  }
}

// ── Proxy matching ───────────────────────────────────────────────────────────

export function matchesProxyFilter(proxyId: string | undefined, proxyType: string | undefined, filter: ProxyFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'has-proxy') return !!proxyId
  if (filter === 'no-proxy') return !proxyId
  if (filter === 'http') return !!proxyId && proxyType === 'http'
  if (filter === 'socks5') return !!proxyId && proxyType === 'socks5'
  return true
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  filters: AdvancedFilterState
  onChange: (filters: AdvancedFilterState) => void
}

interface DropdownProps {
  label: string
  icon: React.ReactNode
  value: string
  isActive: boolean
  children: React.ReactNode
}

function FilterDropdown({ label, icon, value, isActive, children }: DropdownProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
          isActive
            ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
        }`}
      >
        {icon}
        <span>{label}:</span>
        <span className={isActive ? 'text-indigo-200' : 'text-slate-300'}>{value}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px]">
            {React.Children.map(children, (child) =>
              React.isValidElement<{ onClick?: () => void }>(child)
                ? React.cloneElement(child, { onClick: (...args: any[]) => { child.props.onClick?.(...args); setOpen(false) } })
                : child
            )}
          </div>
        </>
      )}
    </div>
  )
}

function FilterOption({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
        active ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-300 hover:bg-slate-700/50'
      }`}
    >
      {label}
    </button>
  )
}

const PLATFORM_LABELS: Record<OsPlatformFilter, { label: string; icon: React.ReactNode }> = {
  all:     { label: 'All',     icon: <Globe2 size={12} /> },
  windows: { label: 'Windows', icon: <Monitor size={12} /> },
  macos:   { label: 'macOS',   icon: <Monitor size={12} /> },
  linux:   { label: 'Linux',   icon: <Monitor size={12} /> },
  android: { label: 'Android', icon: <Smartphone size={12} /> },
  ios:     { label: 'iOS',     icon: <Tablet size={12} /> }
}

const PROXY_LABELS: Record<ProxyFilter, string> = {
  all: 'All',
  'has-proxy': 'Has proxy',
  'no-proxy': 'No proxy',
  http: 'HTTP',
  socks5: 'SOCKS5'
}

const DATE_LABELS: Record<DateRangeFilter, string> = {
  all: 'All time',
  today: 'Today',
  week: 'This week',
  month: 'This month',
  older: '30+ days'
}

export function AdvancedFilters({ filters, onChange }: Props) {
  const activeCount = countActiveFilters(filters)
  const hasFilters = activeCount > 0

  const update = (patch: Partial<AdvancedFilterState>) => onChange({ ...filters, ...patch })
  const reset = () => onChange({ ...DEFAULT_FILTERS })

  return (
    <div className="px-6 pt-2 flex items-center gap-2 flex-wrap">
      {/* Filter icon + label */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
        <Filter size={13} />
        <span>Filters</span>
        {hasFilters && (
          <span className="bg-indigo-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </div>

      {/* Platform filter */}
      <FilterDropdown
        label="Platform"
        icon={PLATFORM_LABELS[filters.platform].icon}
        value={PLATFORM_LABELS[filters.platform].label}
        isActive={filters.platform !== 'all'}
      >
        {(Object.keys(PLATFORM_LABELS) as OsPlatformFilter[]).map((k) => (
          <FilterOption key={k} active={filters.platform === k} label={PLATFORM_LABELS[k].label} onClick={() => update({ platform: k })} />
        ))}
      </FilterDropdown>

      {/* Proxy filter */}
      <FilterDropdown
        label="Proxy"
        icon={<Globe2 size={12} />}
        value={PROXY_LABELS[filters.proxy]}
        isActive={filters.proxy !== 'all'}
      >
        {(Object.keys(PROXY_LABELS) as ProxyFilter[]).map((k) => (
          <FilterOption key={k} active={filters.proxy === k} label={PROXY_LABELS[k]} onClick={() => update({ proxy: k })} />
        ))}
      </FilterDropdown>

      {/* Date range filter */}
      <FilterDropdown
        label="Created"
        icon={<Calendar size={12} />}
        value={DATE_LABELS[filters.dateRange]}
        isActive={filters.dateRange !== 'all'}
      >
        {(Object.keys(DATE_LABELS) as DateRangeFilter[]).map((k) => (
          <FilterOption key={k} active={filters.dateRange === k} label={DATE_LABELS[k]} onClick={() => update({ dateRange: k })} />
        ))}
      </FilterDropdown>

      {/* Preset search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Preset..."
          value={filters.presetSearch}
          onChange={(e) => update({ presetSearch: e.target.value })}
          className={`w-28 h-7 px-2 text-xs rounded-lg border bg-slate-800/50 outline-none transition-colors ${
            filters.presetSearch
              ? 'border-indigo-500/40 text-indigo-200'
              : 'border-slate-700 text-slate-400 placeholder:text-slate-600'
          }`}
        />
        {filters.presetSearch && (
          <button
            onClick={() => update({ presetSearch: '' })}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Active filter badges */}
      {hasFilters && (
        <>
          <div className="w-px h-5 bg-slate-700 mx-1" />
          {filters.platform !== 'all' && (
            <FilterBadge label={`Platform: ${PLATFORM_LABELS[filters.platform].label}`} onClear={() => update({ platform: 'all' })} />
          )}
          {filters.proxy !== 'all' && (
            <FilterBadge label={`Proxy: ${PROXY_LABELS[filters.proxy]}`} onClear={() => update({ proxy: 'all' })} />
          )}
          {filters.dateRange !== 'all' && (
            <FilterBadge label={`Created: ${DATE_LABELS[filters.dateRange]}`} onClear={() => update({ dateRange: 'all' })} />
          )}
          {filters.presetSearch && (
            <FilterBadge label={`Preset: ${filters.presetSearch}`} onClear={() => update({ presetSearch: '' })} />
          )}

          <button
            onClick={reset}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            title="Clear all filters"
          >
            <RotateCcw size={10} />
            Clear all
          </button>
        </>
      )}
    </div>
  )
}

function FilterBadge({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300">
      {label}
      <button onClick={onClear} className="hover:text-white transition-colors">
        <X size={10} />
      </button>
    </span>
  )
}
