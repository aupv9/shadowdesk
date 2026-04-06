import React, { useEffect, useState } from 'react'
import {
  Shield, ShieldCheck, ShieldAlert, Play,
  ChevronDown, CheckCircle, XCircle, Clock,
  BarChart3, RefreshCw
} from 'lucide-react'
import { Header } from '../Layout/Header'
import { useProfileStore } from '../../stores/profileStore'
import type { DetectionTestResult, DetectionTestSummary } from '../../types'

export function DetectionDashboard() {
  const { profiles, fetchProfiles } = useProfileStore()
  const [selectedId, setSelectedId] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<DetectionTestResult[]>([])
  const [summary, setSummary] = useState<DetectionTestSummary | null>(null)
  const [activeResult, setActiveResult] = useState<DetectionTestResult | null>(null)

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

  const scoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400'
    if (score >= 70) return 'text-yellow-400'
    return 'text-red-400'
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'passed':  return 'bg-green-900/40 text-green-400'
      case 'warning': return 'bg-yellow-900/40 text-yellow-400'
      case 'failed':  return 'bg-red-900/40 text-red-400'
      default:        return 'bg-slate-700 text-slate-400'
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Detection Testing"
        subtitle="Test profiles against bot-detection frameworks"
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

        {/* Run Test Panel */}
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-white mb-3">Run Detection Test</h3>
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
            Launches the profile browser and evaluates 20 detection vectors. Results are saved for tracking.
          </p>
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
                  </p>
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge(activeResult.status)}`}>
                {activeResult.status}
              </span>
            </div>

            {/* Vector Results Grid */}
            <div className="space-y-1.5">
              {activeResult.vectors.map((v, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2">
                  {v.passed ? (
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span className={`text-sm flex-1 ${v.passed ? 'text-slate-200' : 'text-red-300'}`}>
                    {v.name}
                  </span>
                  <span className="text-xs text-slate-500">{v.category}</span>
                  {v.detail && (
                    <span className="text-xs text-slate-600 max-w-[200px] truncate" title={v.detail}>
                      {v.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test History */}
        {results.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-3">Test History</h3>
            <div className="space-y-2">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setActiveResult(r)}
                  className="w-full flex items-center gap-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg px-4 py-3 transition-colors text-left"
                >
                  <div className={`text-lg font-bold w-12 text-center ${scoreColor(r.overallScore)}`}>
                    {r.overallScore}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{r.profileName}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(r.testedAt).toLocaleString()} — {r.vectors.filter(v => v.passed).length}/{r.vectors.length} passed
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(r.status)}`}>
                    {r.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
