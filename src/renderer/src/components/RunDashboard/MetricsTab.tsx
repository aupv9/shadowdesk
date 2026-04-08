import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  TrendingUp, AlertTriangle, CheckCircle, Clock, Zap, RefreshCw,
  XCircle, BarChart3, Activity
} from 'lucide-react'

interface WorkflowMetrics {
  total: number
  completed: number
  failed: number
  stopped: number
  avgDurationMs: number
  successRate: number
  last7Days: { date: string; total: number; failed: number }[]
  actionErrors: { action: string; count: number }[]
}

interface ActionMetric {
  action: string
  count: number
  avg_ms: number
  min_ms: number
  max_ms: number
  failure_rate: number
}

/**
 * Phase 19.1 — Module-level cache that survives MetricsTab unmount/remount.
 *
 * The Run Dashboard parent uses conditional rendering (`{tab === 'metrics' && <MetricsTab />}`),
 * which destroys this component every time the user switches tabs. Without a
 * cache outside React state, every tab switch retriggered two IPC roundtrips
 * (`workflows.metrics` + `workflows.actionMetrics`) — a noticeable flash even
 * with the new backend cache.
 *
 * Keyed by workflow filter so different filters don't pollute each other.
 * TTL matches the backend cache so a manual refresh always wins.
 */
interface MetricsCacheEntry {
  metrics: WorkflowMetrics | null
  actionMetrics: ActionMetric[]
  fetchedAt: number
}
const METRICS_CACHE = new Map<string, MetricsCacheEntry>()
const METRICS_CACHE_TTL_MS = 30_000

function formatMs(ms: number): string {
  if (!ms || ms <= 0) return '0ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** Inline SVG sparkline / bar chart for the 7-day series. */
function MiniBars({ data }: { data: { date: string; total: number; failed: number }[] }) {
  if (!data.length) return <div className="text-xs text-slate-600 py-4 text-center">No runs in the last 7 days</div>
  const max = Math.max(1, ...data.map((d) => d.total))
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d) => {
        const okHeight = Math.round(((d.total - d.failed) / max) * 100)
        const failHeight = Math.round((d.failed / max) * 100)
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center group">
            <div className="flex flex-col-reverse w-full items-stretch gap-px h-full" title={`${d.date}: ${d.total} runs, ${d.failed} failed`}>
              {okHeight > 0 && (
                <div className="bg-green-500/70 group-hover:bg-green-400 rounded-sm transition-colors" style={{ height: `${okHeight}%` }} />
              )}
              {failHeight > 0 && (
                <div className="bg-red-500/70 group-hover:bg-red-400 rounded-sm transition-colors" style={{ height: `${failHeight}%` }} />
              )}
            </div>
            <div className="text-[9px] text-slate-600 mt-1">{d.date.slice(5)}</div>
          </div>
        )
      })}
    </div>
  )
}

export function MetricsTab() {
  const [workflowFilter, setWorkflowFilter] = useState<string>('')
  const [workflows, setWorkflows] = useState<{ id: string; name: string }[]>([])
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(() => {
    const cached = METRICS_CACHE.get('')
    return cached && Date.now() - cached.fetchedAt < METRICS_CACHE_TTL_MS ? cached.metrics : null
  })
  const [actionMetrics, setActionMetrics] = useState<ActionMetric[]>(() => {
    const cached = METRICS_CACHE.get('')
    return cached && Date.now() - cached.fetchedAt < METRICS_CACHE_TTL_MS ? cached.actionMetrics : []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef<string | null>(null)

  /**
   * Phase 19.1: `force=true` bypasses both the renderer cache and (via the
   * separate Refresh button) the backend cache TTL. Default reads return
   * cached data instantly when fresh — fixing the tab-switch flash.
   */
  const fetchAll = async (force = false) => {
    const cacheKey = workflowFilter
    if (!force) {
      const cached = METRICS_CACHE.get(cacheKey)
      if (cached && Date.now() - cached.fetchedAt < METRICS_CACHE_TTL_MS) {
        setMetrics(cached.metrics)
        setActionMetrics(cached.actionMetrics)
        return
      }
    }
    // De-dupe concurrent fetches for the same key (e.g. effect + user click).
    if (inFlightRef.current === cacheKey) return
    inFlightRef.current = cacheKey

    setLoading(true)
    setError(null)
    try {
      const m = await window.api.workflows.metrics(workflowFilter || undefined)
      const am = await window.api.workflows.actionMetrics(workflowFilter || undefined, 200)
      const safeAm = am || []
      setMetrics(m)
      setActionMetrics(safeAm)
      METRICS_CACHE.set(cacheKey, {
        metrics: m,
        actionMetrics: safeAm,
        fetchedAt: Date.now(),
      })
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load metrics')
    } finally {
      setLoading(false)
      if (inFlightRef.current === cacheKey) inFlightRef.current = null
    }
  }

  useEffect(() => {
    window.api.workflows.list().then((ws: any[]) => {
      setWorkflows(ws.map((w) => ({ id: w.id, name: w.name })))
    }).catch(() => {})
  }, [])

  useEffect(() => { fetchAll() }, [workflowFilter])

  const sortedActions = useMemo(() => {
    return [...actionMetrics].sort((a, b) => b.count - a.count)
  }, [actionMetrics])

  return (
    <div className="p-6 space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <select
          value={workflowFilter}
          onChange={(e) => setWorkflowFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 max-w-[260px]"
        >
          <option value="">All workflows</option>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <button
          onClick={() => fetchAll(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Activity className="w-4 h-4 text-ghost-400" />}
          label="Total runs"
          value={metrics?.total ?? 0}
        />
        <KpiCard
          icon={<CheckCircle className="w-4 h-4 text-green-400" />}
          label="Success rate"
          value={`${metrics?.successRate ?? 0}%`}
          subValue={`${metrics?.completed ?? 0} ok`}
        />
        <KpiCard
          icon={<XCircle className="w-4 h-4 text-red-400" />}
          label="Failed"
          value={metrics?.failed ?? 0}
          subValue={`${metrics?.stopped ?? 0} stopped`}
        />
        <KpiCard
          icon={<Clock className="w-4 h-4 text-blue-400" />}
          label="Avg duration"
          value={formatMs(metrics?.avgDurationMs ?? 0)}
        />
      </div>

      {/* 7-day trend */}
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-ghost-400" />
          <h3 className="text-sm font-medium text-white">Last 7 days</h3>
          <span className="text-xs text-slate-500 ml-auto">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-sm mr-1" />success
            <span className="inline-block w-2 h-2 bg-red-500 rounded-sm ml-2 mr-1" />failed
          </span>
        </div>
        <MiniBars data={metrics?.last7Days ?? []} />
      </div>

      {/* Top action errors */}
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-medium text-white">Top failing actions</h3>
        </div>
        {(metrics?.actionErrors ?? []).length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No action errors recorded</div>
        ) : (
          <div className="space-y-1.5">
            {(metrics?.actionErrors ?? []).map((a) => {
              const max = Math.max(...(metrics?.actionErrors ?? []).map((x) => x.count))
              const pct = Math.round((a.count / max) * 100)
              return (
                <div key={a.action} className="flex items-center gap-2 text-xs">
                  <span className="w-32 text-slate-400 truncate">{a.action}</span>
                  <div className="flex-1 h-2 bg-slate-900 rounded">
                    <div className="h-full bg-red-500/70 rounded" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-slate-500">{a.count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Per-action performance */}
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-ghost-400" />
          <h3 className="text-sm font-medium text-white">Action performance</h3>
          <span className="text-xs text-slate-500 ml-auto">last 200 runs</span>
        </div>
        {sortedActions.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No action metrics yet — run a workflow first.</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[1fr_60px_70px_70px_70px_80px] gap-2 px-2 py-1.5 text-[10px] uppercase tracking-wider text-slate-600 border-b border-slate-700/50">
              <div>Action</div>
              <div className="text-right">Count</div>
              <div className="text-right">Avg</div>
              <div className="text-right">Min</div>
              <div className="text-right">Max</div>
              <div className="text-right">Failure</div>
            </div>
            {sortedActions.map((a) => (
              <div key={a.action} className="grid grid-cols-[1fr_60px_70px_70px_70px_80px] gap-2 px-2 py-1.5 text-xs hover:bg-slate-900/40 rounded">
                <div className="text-slate-300 truncate">{a.action}</div>
                <div className="text-right text-slate-500">{a.count}</div>
                <div className="text-right text-slate-400">{formatMs(a.avg_ms)}</div>
                <div className="text-right text-slate-600">{formatMs(a.min_ms)}</div>
                <div className="text-right text-slate-600">{formatMs(a.max_ms)}</div>
                <div className={`text-right ${a.failure_rate > 0 ? 'text-red-400' : 'text-slate-600'}`}>
                  {a.failure_rate > 0 ? `${a.failure_rate}%` : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, subValue }: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  subValue?: string
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subValue && <div className="text-xs text-slate-500 mt-0.5">{subValue}</div>}
    </div>
  )
}
