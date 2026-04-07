import React, { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle, XCircle, Square, Clock, Download, RefreshCw, Filter, Search,
  ChevronDown, ChevronRight, AlertCircle
} from 'lucide-react'

interface RunRow {
  id: string
  workflow_id: string
  workflow_name?: string
  profile_id: string
  profile_name?: string
  status: 'completed' | 'failed' | 'stopped'
  started_at: string
  duration_ms?: number | null
  step_results: any[]
  variables?: Record<string, string> | null
  error?: string
}

type StatusFilter = 'all' | 'completed' | 'failed' | 'stopped'

const PAGE_SIZE = 50

/** Format duration in ms to human-readable. */
function formatDuration(ms?: number | null): string {
  if (!ms || ms <= 0) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 100) / 10
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rs = Math.round(s - m * 60)
  return `${m}m ${rs}s`
}

/** Convert array of run rows to CSV string. */
function runsToCsv(rows: RunRow[]): string {
  const header = ['id', 'workflow', 'profile', 'status', 'started_at', 'duration_ms', 'steps', 'failed_steps', 'error']
  const lines = [header.join(',')]
  for (const r of rows) {
    const steps = r.step_results?.length ?? 0
    const failed = r.step_results?.filter((s: any) => s && s.success === false).length ?? 0
    const cells = [
      r.id,
      r.workflow_name ?? r.workflow_id,
      r.profile_name ?? r.profile_id,
      r.status,
      r.started_at,
      String(r.duration_ms ?? ''),
      String(steps),
      String(failed),
      r.error ?? ''
    ].map((v) => {
      const s = String(v).replace(/"/g, '""')
      return /[",\n]/.test(s) ? `"${s}"` : s
    })
    lines.push(cells.join(','))
  }
  return lines.join('\n')
}

/** Trigger a download in the browser. */
function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function RunHistoryTab() {
  const [rows, setRows] = useState<RunRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [workflowFilter, setWorkflowFilter] = useState('')
  const [profileFilter, setProfileFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(200)

  const fetchRuns = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api.workflows.recentRuns(limit)
      setRows(data || [])
    } catch (e: any) {
      setError(e?.message ?? 'Failed to fetch runs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRuns() }, [limit])

  // Distinct workflows / profiles for filter dropdowns
  const workflows = useMemo(() => {
    const set = new Map<string, string>()
    for (const r of rows) set.set(r.workflow_id, r.workflow_name ?? r.workflow_id)
    return Array.from(set.entries())
  }, [rows])

  const profiles = useMemo(() => {
    const set = new Map<string, string>()
    for (const r of rows) set.set(r.profile_id, r.profile_name ?? r.profile_id)
    return Array.from(set.entries())
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (workflowFilter && r.workflow_id !== workflowFilter) return false
      if (profileFilter && r.profile_id !== profileFilter) return false
      if (q) {
        const hay = `${r.workflow_name ?? ''} ${r.profile_name ?? ''} ${r.error ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, status, workflowFilter, profileFilter, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [status, workflowFilter, profileFilter, search])

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExportCsv = () => {
    if (filtered.length === 0) return
    const stamp = new Date().toISOString().slice(0, 10)
    downloadFile(`runs_${stamp}.csv`, runsToCsv(filtered), 'text/csv;charset=utf-8')
  }

  const handleExportJson = () => {
    if (filtered.length === 0) return
    const stamp = new Date().toISOString().slice(0, 10)
    downloadFile(`runs_${stamp}.json`, JSON.stringify(filtered, null, 2), 'application/json')
  }

  return (
    <div className="p-6 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflow / profile / error..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-ghost-500"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300"
        >
          <option value="all">All status</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="stopped">Stopped</option>
        </select>

        <select
          value={workflowFilter}
          onChange={(e) => setWorkflowFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 max-w-[180px]"
        >
          <option value="">All workflows</option>
          {workflows.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        <select
          value={profileFilter}
          onChange={(e) => setProfileFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 max-w-[180px]"
        >
          <option value="">All profiles</option>
          {profiles.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        <select
          value={limit}
          onChange={(e) => setLimit(parseInt(e.target.value, 10))}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300"
          title="Max rows to fetch from DB"
        >
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
          <option value={1000}>1000</option>
        </select>

        <button
          onClick={fetchRuns}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        <button
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-ghost-600/20 hover:bg-ghost-600/40 disabled:opacity-30 text-ghost-300 rounded-lg"
          title="Export filtered rows as CSV"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>

        <button
          onClick={handleExportJson}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-ghost-600/20 hover:bg-ghost-600/40 disabled:opacity-30 text-ghost-300 rounded-lg"
          title="Export filtered rows as JSON"
        >
          <Download className="w-3.5 h-3.5" />
          JSON
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="text-xs text-slate-500 flex items-center gap-2">
        <Filter className="w-3 h-3" />
        Showing {filtered.length} of {rows.length} runs
        {filtered.length > 0 && (
          <span className="text-slate-600">
            · {filtered.filter(r => r.status === 'completed').length} ok
            · {filtered.filter(r => r.status === 'failed').length} failed
            · {filtered.filter(r => r.status === 'stopped').length} stopped
          </span>
        )}
      </div>

      {/* Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[24px_1fr_1fr_100px_90px_140px_60px] gap-2 px-3 py-2 bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
          <div></div>
          <div>Workflow</div>
          <div>Profile</div>
          <div>Status</div>
          <div>Duration</div>
          <div>Started</div>
          <div className="text-right">Steps</div>
        </div>

        {loading && rows.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading runs…</div>
        ) : pageRows.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No runs found</div>
        ) : (
          pageRows.map((r) => {
            const isOpen = expanded.has(r.id)
            const failedSteps = r.step_results?.filter((s: any) => s && s.success === false).length ?? 0
            return (
              <div key={r.id} className="border-b border-slate-800/60 last:border-0">
                <button
                  onClick={() => toggleRow(r.id)}
                  className="grid grid-cols-[24px_1fr_1fr_100px_90px_140px_60px] gap-2 px-3 py-2 w-full text-left text-xs hover:bg-slate-800/40 transition-colors items-center"
                >
                  <div>
                    {isOpen ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                  </div>
                  <div className="text-slate-200 truncate">{r.workflow_name ?? r.workflow_id}</div>
                  <div className="text-slate-400 truncate">{r.profile_name ?? r.profile_id}</div>
                  <div className="flex items-center gap-1.5">
                    {r.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-400" />}
                    {r.status === 'failed'    && <XCircle className="w-3 h-3 text-red-400" />}
                    {r.status === 'stopped'   && <Square className="w-3 h-3 text-yellow-400" />}
                    <span className="capitalize text-slate-400">{r.status}</span>
                  </div>
                  <div className="text-slate-500">{formatDuration(r.duration_ms)}</div>
                  <div className="text-slate-500 truncate flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(r.started_at).toLocaleString()}
                  </div>
                  <div className="text-right text-slate-500">
                    {r.step_results?.length ?? 0}
                    {failedSteps > 0 && <span className="text-red-400"> ({failedSteps})</span>}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-9 pb-3 pt-1 bg-slate-900/40 space-y-2">
                    {r.error && (
                      <div className="flex items-start gap-2 text-xs text-red-400 px-2 py-1.5 bg-red-500/5 border border-red-500/20 rounded">
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="font-mono">{r.error}</span>
                      </div>
                    )}
                    {r.variables && Object.keys(r.variables).length > 0 && (
                      <div className="text-[11px] text-slate-500">
                        <span className="text-slate-600">vars: </span>
                        {Object.entries(r.variables).map(([k, v]) => (
                          <code key={k} className="mr-2 text-ghost-300">{k}={String(v).slice(0, 20)}</code>
                        ))}
                      </div>
                    )}
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {(r.step_results ?? []).map((s: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                          {s.success
                            ? <CheckCircle className="w-2.5 h-2.5 text-green-400 shrink-0" />
                            : <XCircle className="w-2.5 h-2.5 text-red-400 shrink-0" />
                          }
                          <span className="text-slate-400 w-24 truncate">{s.action}</span>
                          <span className="text-slate-600 w-14">{s.duration_ms}ms</span>
                          {s.error && <span className="text-red-400 truncate flex-1">{s.error}</span>}
                          {!s.error && s.output?.text && <span className="text-slate-500 truncate flex-1 font-mono">{String(s.output.text).slice(0, 80)}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-300"
          >Prev</button>
          <span className="text-slate-500">Page {page + 1} of {pageCount}</span>
          <button
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-300"
          >Next</button>
        </div>
      )}
    </div>
  )
}
