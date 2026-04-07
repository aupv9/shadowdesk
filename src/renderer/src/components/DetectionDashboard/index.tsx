import React, { useEffect, useState } from 'react'
import {
  Shield, ShieldCheck, ShieldAlert, Play,
  ChevronDown, CheckCircle, XCircle, Clock,
  BarChart3, RefreshCw, Trash2, ListChecks,
  AlertTriangle, X, ChevronRight, Download, ExternalLink
} from 'lucide-react'
import { Header } from '../Layout/Header'
import { useProfileStore } from '../../stores/profileStore'
import { HealthTrendChart } from './HealthTrendChart'
import { CategoryScoreChart } from './CategoryScoreChart'
import type { DetectionTestResult, DetectionTestSummary, BatchTestStatus } from '../../types'
import type { NavSection } from '../../types'

// Group detection vector categories for breakdown display
const CATEGORY_ORDER = ['Automation', 'Browser', 'Graphics', 'Audio', 'Hardware', 'Locale', 'Timing', 'API']

interface Props {
  onNavigate?: (section: NavSection) => void
}

export function DetectionDashboard({ onNavigate }: Props) {
  const { profiles, fetchProfiles } = useProfileStore()
  const [selectedId,       setSelectedId]       = useState<string>('')
  const [running,          setRunning]          = useState(false)
  const [batchRunning,     setBatchRunning]      = useState(false)
  const [batchStatus,      setBatchStatus]       = useState<BatchTestStatus | null>(null)
  const [results,          setResults]          = useState<DetectionTestResult[]>([])
  const [summary,          setSummary]          = useState<DetectionTestSummary | null>(null)
  const [activeResult,     setActiveResult]     = useState<DetectionTestResult | null>(null)
  const [showBatchPanel,   setShowBatchPanel]   = useState(false)
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set())
  const [confirmClear,     setConfirmClear]     = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  useEffect(() => {
    if (profiles.length === 0) fetchProfiles()
    loadSummary()
    loadResults()
  }, [])

  const loadSummary = async () => {
    const s = await window.api.detection.summary()
    setSummary(s)
  }

  const loadResults = async (profileId?: string) => {
    const r = await window.api.detection.results(profileId)
    setResults(r)
  }

  const handleRunTest = async () => {
    if (!selectedId || running) return
    setRunning(true)
    try {
      const result = await window.api.detection.runTest(selectedId)
      setActiveResult(result)
      await loadResults()
      await loadSummary()
    } catch (err: any) {
      console.error('Detection test failed:', err)
    } finally {
      setRunning(false)
    }
  }

  const handleBatchTest = async () => {
    const ids = Array.from(selectedProfiles)
    if (ids.length === 0 || batchRunning) return
    setBatchRunning(true)
    setBatchStatus(null)
    try {
      const status = await window.api.detection.batchTest(ids)
      setBatchStatus(status)
      await loadResults()
      await loadSummary()
      if (status.results.length > 0) {
        setActiveResult(status.results[status.results.length - 1])
      }
    } catch (err: any) {
      console.error('Batch test failed:', err)
    } finally {
      setBatchRunning(false)
    }
  }

  const handleDeleteResult = async (resultId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await window.api.detection.deleteResult(resultId)
    if (activeResult?.id === resultId) setActiveResult(null)
    await loadResults()
    await loadSummary()
  }

  const handleClearHistory = async () => {
    await window.api.detection.clearHistory()
    setResults([])
    setActiveResult(null)
    setConfirmClear(false)
    await loadSummary()
  }

  const toggleProfileSelection = (id: string) => {
    setSelectedProfiles(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllProfiles = () => {
    setSelectedProfiles(new Set(profiles.map(p => p.id)))
  }

  const clearSelection = () => setSelectedProfiles(new Set())

  const handleExportCSV = () => {
    if (results.length === 0) return
    const rows: string[] = ['Profile,Score,Status,TestedAt,Vector,Category,Passed,Detail']
    for (const r of results) {
      for (const v of r.vectors) {
        rows.push([
          `"${r.profileName}"`, r.overallScore, r.status, r.testedAt,
          `"${v.name}"`, v.category, v.passed ? 'true' : 'false',
          `"${(v.detail ?? '').replace(/"/g, "'")}"`
        ].join(','))
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `detection-results-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const scoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400'
    if (score >= 70) return 'text-yellow-400'
    return 'text-red-400'
  }

  const scoreBarColor = (score: number) => {
    if (score >= 90) return 'bg-green-500'
    if (score >= 70) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'passed':  return 'bg-green-900/40 text-green-400'
      case 'warning': return 'bg-yellow-900/40 text-yellow-400'
      case 'failed':  return 'bg-red-900/40 text-red-400'
      default:        return 'bg-slate-700 text-slate-400'
    }
  }

  // Group vectors by category for breakdown view
  const vectorsByCategory = (vectors: DetectionTestResult['vectors']) => {
    const map = new Map<string, typeof vectors>()
    for (const v of vectors) {
      if (!map.has(v.category)) map.set(v.category, [])
      map.get(v.category)!.push(v)
    }
    return map
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Detection Testing"
        subtitle="Test profiles against bot-detection frameworks"
        actions={
          results.length > 0 ? (
            <button
              onClick={handleExportCSV}
              className="btn-ghost flex items-center gap-2 text-sm"
              title="Export results as CSV"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-ghost-600/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-ghost-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {summary?.totalTests ?? 0}
                </div>
                <div className="text-xs text-slate-400">Tests Run</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-ghost-600/20 flex items-center justify-center">
                <Shield className={`w-5 h-5 ${scoreColor(summary?.averageScore ?? 0)}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${scoreColor(summary?.averageScore ?? 0)}`}>
                  {summary?.averageScore ?? 0}%
                </div>
                <div className="text-xs text-slate-400">Average Score</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-ghost-600/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white truncate">
                  {summary?.lastTestedAt
                    ? new Date(summary.lastTestedAt).toLocaleDateString()
                    : 'Never'}
                </div>
                <div className="text-xs text-slate-400">Last Tested</div>
              </div>
            </div>
          </div>
        </div>

        {/* Phase 11.1 — Health score trending chart */}
        <HealthTrendChart results={results} />

        {/* Run Test Panel */}
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Run Detection Test</h3>
            <button
              onClick={() => setShowBatchPanel(!showBatchPanel)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                showBatchPanel
                  ? 'bg-ghost-600/30 text-ghost-300'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              Batch Test
            </button>
          </div>

          {!showBatchPanel ? (
            <>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <select
                    className="input appearance-none pr-8"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    <option value="">— Select a profile to test —</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <button
                  onClick={handleRunTest}
                  disabled={!selectedId || running}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-ghost-600 hover:bg-ghost-500
                             text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {running ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {running ? 'Testing...' : 'Run Test'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Launches the profile browser and evaluates 30 detection vectors across 7 categories. Results are saved for tracking.
              </p>
            </>
          ) : (
            /* Batch Test Panel */
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400">
                  Select profiles to test simultaneously ({selectedProfiles.size} selected)
                </p>
                <div className="flex gap-2">
                  <button onClick={selectAllProfiles} className="text-xs text-ghost-400 hover:text-ghost-300">
                    All
                  </button>
                  <span className="text-slate-600">·</span>
                  <button onClick={clearSelection} className="text-xs text-slate-500 hover:text-slate-300">
                    None
                  </button>
                </div>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1 mb-3">
                {profiles.map(p => (
                  <label key={p.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProfiles.has(p.id)}
                      onChange={() => toggleProfileSelection(p.id)}
                      className="accent-ghost-500"
                    />
                    <span className="text-sm text-slate-200">{p.name}</span>
                    <span className="text-xs text-slate-500 ml-auto">{p.fingerprint?.preset}</span>
                  </label>
                ))}
              </div>

              <button
                onClick={handleBatchTest}
                disabled={selectedProfiles.size === 0 || batchRunning}
                className="flex items-center gap-2 px-4 py-2.5 w-full justify-center rounded-lg bg-ghost-600 hover:bg-ghost-500
                           text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {batchRunning ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ListChecks className="w-4 h-4" />
                )}
                {batchRunning
                  ? 'Running batch test...'
                  : `Test ${selectedProfiles.size} profile${selectedProfiles.size !== 1 ? 's' : ''}`}
              </button>

              {batchStatus && (
                <div className="mt-3 p-3 bg-slate-800/60 rounded-lg text-xs">
                  <span className="text-green-400">{batchStatus.completed} passed</span>
                  {batchStatus.failed > 0 && (
                    <span className="text-red-400 ml-2">{batchStatus.failed} failed</span>
                  )}
                  <span className="text-slate-500 ml-2">of {batchStatus.total} total</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active Result Detail */}
        {activeResult && (
          <div className="card mb-6 border-ghost-600/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {activeResult.status === 'passed' ? (
                  <ShieldCheck className="w-6 h-6 text-green-400" />
                ) : activeResult.status === 'warning' ? (
                  <ShieldAlert className="w-6 h-6 text-yellow-400" />
                ) : (
                  <ShieldAlert className="w-6 h-6 text-red-400" />
                )}
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {activeResult.profileName} — Score: {activeResult.overallScore}%
                  </h3>
                  <p className="text-xs text-slate-400">
                    {activeResult.vectors.filter(v => v.passed).length}/{activeResult.vectors.length} vectors passed
                    · {new Date(activeResult.testedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge(activeResult.status)}`}>
                  {activeResult.status}
                </span>
                <button
                  onClick={(e) => handleDeleteResult(activeResult.id, e)}
                  title="Delete this result"
                  className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-600/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Score bar */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full mb-4">
              <div
                className={`h-full rounded-full transition-all ${scoreBarColor(activeResult.overallScore)}`}
                style={{ width: `${activeResult.overallScore}%` }}
              />
            </div>

            {/* Per-category score breakdown chart */}
            <CategoryScoreChart result={activeResult} />

            {/* Category breakdown */}
            <div className="space-y-1">
              {Array.from(vectorsByCategory(activeResult.vectors).entries())
                .sort(([a], [b]) => {
                  const ai = CATEGORY_ORDER.indexOf(a)
                  const bi = CATEGORY_ORDER.indexOf(b)
                  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
                })
                .map(([category, vectors]) => {
                  const passed = vectors.filter(v => v.passed).length
                  const isExpanded = expandedCategory === category
                  const allPassed = passed === vectors.length
                  const nonePassed = passed === 0

                  return (
                    <div key={category} className="rounded-lg overflow-hidden border border-slate-800">
                      <button
                        onClick={() => setExpandedCategory(isExpanded ? null : category)}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
                      >
                        {allPassed ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        ) : nonePassed ? (
                          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                        )}
                        <span className="text-xs font-medium text-slate-200 flex-1">{category}</span>
                        <span className={`text-xs ${allPassed ? 'text-green-400' : nonePassed ? 'text-red-400' : 'text-yellow-400'}`}>
                          {passed}/{vectors.length}
                        </span>
                        <ChevronRight className={`w-3 h-3 text-slate-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>

                      {isExpanded && (
                        <div className="divide-y divide-slate-800/50">
                          {vectors.map((v, i) => (
                            <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-slate-900/30">
                              {v.passed ? (
                                <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                              )}
                              <span className={`text-xs flex-1 ${v.passed ? 'text-slate-300' : 'text-red-300'}`}>
                                {v.name}
                              </span>
                              {v.detail && (
                                <span className="text-xs text-slate-600 max-w-[140px] truncate" title={v.detail}>
                                  {v.detail}
                                </span>
                              )}
                              {!v.passed && onNavigate && (
                                <button
                                  onClick={() => onNavigate('fingerprint')}
                                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded
                                             text-ghost-400 hover:text-ghost-200 hover:bg-ghost-600/20
                                             transition-colors shrink-0"
                                  title="Open Fingerprint Editor to review this vector"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Fix
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Test History */}
        {results.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Test History</h3>
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear all
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Clear all history?</span>
                  <button
                    onClick={handleClearHistory}
                    className="text-xs px-2 py-0.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="p-0.5 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {results.map((r) => (
                <div
                  key={r.id}
                  className="group flex items-center gap-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg px-4 py-3 transition-colors cursor-pointer"
                  onClick={() => {
                    setActiveResult(r)
                    setExpandedCategory(null)
                  }}
                >
                  <div className={`text-lg font-bold w-12 text-center ${scoreColor(r.overallScore)}`}>
                    {r.overallScore}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{r.profileName}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(r.testedAt).toLocaleString()} · {r.vectors.filter(v => v.passed).length}/{r.vectors.length} passed
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(r.status)}`}>
                    {r.status}
                  </span>
                  <button
                    onClick={(e) => handleDeleteResult(r.id, e)}
                    title="Delete"
                    className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-600/10
                               transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
