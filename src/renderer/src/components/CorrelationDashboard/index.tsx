import React, { useEffect, useMemo, useState } from 'react'
import {
  Radar,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  Users,
  Keyboard,
  MousePointer2,
  ScrollText,
  Sparkles,
  History,
  X,
  Lightbulb,
} from 'lucide-react'
import { Header } from '../Layout/Header'
import type {
  BehaviorCorrelationReport,
  BehaviorCorrelationPair,
} from '../../types'

/**
 * Phase 21 — Behavior Correlation Dashboard
 *
 * Multi-Account Behavior Correlation Detector UI.
 *
 * Pulls every profile's fingerprint.behavior through the IPC scan endpoint,
 * renders:
 *   - a hero row with the three counts (total, high-risk, medium-risk)
 *   - the list of flagged profile pairs with similarity %, risk chip,
 *     per-axis breakdown (typing / mouse / scroll), and recommendations
 *   - a global "Recommendations" card
 *   - an archetype usage histogram so users can diversify at a glance
 *   - a collapsible history of previous scans (persisted reports)
 *
 * The user can adjust the threshold slider, rerun scans, and delete historical
 * reports. All heavy lifting happens in the main process via
 * `window.api.correlation.scan()`.
 */

type HistoryEntry = {
  id: string
  scannedAt: string
  threshold: number
  profileCount: number
  pairsEvaluated: number
  highRiskCount: number
  mediumRiskCount: number
}

const RISK_STYLES: Record<BehaviorCorrelationPair['risk'], string> = {
  high:   'bg-red-900/40 text-red-300 border-red-700/50',
  medium: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
  low:    'bg-slate-800 text-slate-300 border-slate-700',
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function similarityColor(sim: number): string {
  if (sim >= 0.9) return 'text-red-400'
  if (sim >= 0.85) return 'text-amber-400'
  return 'text-slate-300'
}

export function CorrelationDashboard() {
  const [report, setReport] = useState<BehaviorCorrelationReport | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [threshold, setThreshold] = useState(0.85)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedPair, setExpandedPair] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    void runScan()
    void loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const rows = await window.api.correlation.history(25)
      setHistory(rows as HistoryEntry[])
    } catch (err: any) {
      console.error('[Correlation] history failed:', err)
    }
  }

  const runScan = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = (await window.api.correlation.scan({
        threshold,
        persist: true,
      })) as BehaviorCorrelationReport
      setReport(result)
      await loadHistory()
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  const loadReport = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = (await window.api.correlation.get(id)) as BehaviorCorrelationReport
      setReport(result)
      setThreshold(result.threshold)
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  const deleteReport = async (id: string) => {
    try {
      await window.api.correlation.delete(id)
      await loadHistory()
    } catch (err: any) {
      console.error('[Correlation] delete failed:', err)
    }
  }

  const archetypeEntries = useMemo(() => {
    if (!report) return []
    return Object.entries(report.archetypeUsage).sort((a, b) => b[1] - a[1])
  }, [report])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Behavior Correlation"
        subtitle="Detect profiles whose behavioral fingerprint is so similar they could be clustered as the same operator"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="btn-ghost flex items-center gap-1.5 text-sm"
            >
              <History className="w-4 h-4" />
              History
            </button>
            <button
              onClick={runScan}
              disabled={loading}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Scanning…' : 'Scan now'}
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {error && (
          <div className="card border-red-700/50 bg-red-900/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm text-red-300">{error}</div>
          </div>
        )}

        {/* Threshold slider */}
        <div className="card">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Radar className="w-4 h-4 text-ghost-400" />
              <div className="text-sm font-medium text-white">
                Similarity threshold
              </div>
            </div>
            <div className="text-sm text-slate-300">
              {(threshold * 100).toFixed(0)}%
            </div>
          </div>
          <input
            type="range"
            min={0.5}
            max={0.99}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-full mt-3 accent-ghost-500"
          />
          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>50% (very sensitive)</span>
            <span>85% (recommended)</span>
            <span>99% (exact match)</span>
          </div>
        </div>

        {/* Hero stats */}
        {report && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="Profiles scanned"
              value={report.profileCount}
              tone="neutral"
              sub={`${report.pairsEvaluated} pairs evaluated`}
            />
            <StatCard
              icon={AlertTriangle}
              label="High-risk alerts"
              value={report.highRiskCount}
              tone={report.highRiskCount > 0 ? 'red' : 'green'}
              sub="≥ 90% similarity"
            />
            <StatCard
              icon={AlertTriangle}
              label="Medium-risk alerts"
              value={report.mediumRiskCount}
              tone={report.mediumRiskCount > 0 ? 'amber' : 'green'}
              sub="85% – 90% similarity"
            />
            <StatCard
              icon={ShieldCheck}
              label="Scanned at"
              value={formatTimestamp(report.scannedAt).split(',')[0]}
              tone="neutral"
              sub={formatTimestamp(report.scannedAt).split(',').slice(1).join(',').trim()}
            />
          </div>
        )}

        {/* Global recommendations */}
        {report && report.globalRecommendations.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">
                Pool-level recommendations
              </h3>
            </div>
            <ul className="space-y-2">
              {report.globalRecommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-ghost-400 shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Archetype usage */}
        {report && archetypeEntries.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-ghost-400" />
              <h3 className="text-sm font-semibold text-white">
                Archetype diversity
              </h3>
            </div>
            <div className="space-y-2">
              {archetypeEntries.map(([arch, count]) => {
                const pct = report.profileCount > 0
                  ? Math.round((count / report.profileCount) * 100)
                  : 0
                return (
                  <div key={arch} className="flex items-center gap-3">
                    <div className="w-32 text-xs text-slate-300 truncate">
                      {arch === 'none' ? '— no archetype —' : arch}
                    </div>
                    <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-ghost-500/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 w-20 text-right">
                      {count} ({pct}%)
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Alerts list */}
        {report && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Flagged profile pairs{' '}
                <span className="text-slate-500 font-normal">
                  ({report.alerts.length})
                </span>
              </h3>
            </div>

            {report.alerts.length === 0 ? (
              <div className="card flex items-center gap-3 border-green-700/40 bg-green-900/10">
                <ShieldCheck className="w-5 h-5 text-green-400" />
                <div className="text-sm text-slate-200">
                  No behavioral correlation detected above{' '}
                  {(threshold * 100).toFixed(0)}% — your profile pool looks
                  healthy.
                </div>
              </div>
            ) : (
              report.alerts.map((pair) => (
                <PairCard
                  key={pair.id}
                  pair={pair}
                  expanded={expandedPair === pair.id}
                  onToggle={() =>
                    setExpandedPair((v) => (v === pair.id ? null : pair.id))
                  }
                />
              ))
            )}
          </div>
        )}

        {!report && !loading && (
          <div className="card text-center py-10 text-slate-400 text-sm">
            Click <strong>Scan now</strong> to evaluate correlation across
            your profile pool.
          </div>
        )}
      </div>

      {/* History drawer */}
      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-800 shadow-xl z-40 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-ghost-400" />
              <div className="text-sm font-semibold text-white">
                Previous scans
              </div>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {history.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8">
                No previous scans yet.
              </div>
            ) : (
              history.map((h) => (
                <div
                  key={h.id}
                  className="card hover:border-ghost-500/60 transition-colors cursor-pointer p-3"
                  onClick={() => loadReport(h.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-300">
                      {formatTimestamp(h.scannedAt)}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteReport(h.id)
                      }}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400">
                      {h.profileCount} profiles
                    </span>
                    <span className="text-slate-600">•</span>
                    <span
                      className={
                        h.highRiskCount > 0 ? 'text-red-400' : 'text-slate-500'
                      }
                    >
                      {h.highRiskCount} high
                    </span>
                    <span className="text-slate-600">•</span>
                    <span
                      className={
                        h.mediumRiskCount > 0
                          ? 'text-amber-400'
                          : 'text-slate-500'
                      }
                    >
                      {h.mediumRiskCount} med
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500">
                      @ {(h.threshold * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  tone: 'red' | 'amber' | 'green' | 'neutral'
  sub?: string
}

function StatCard({ icon: Icon, label, value, tone, sub }: StatCardProps) {
  const toneStyles: Record<StatCardProps['tone'], string> = {
    red:     'border-red-700/50 bg-red-900/10',
    amber:   'border-amber-700/50 bg-amber-900/10',
    green:   'border-green-700/50 bg-green-900/10',
    neutral: '',
  }
  const iconColor: Record<StatCardProps['tone'], string> = {
    red:     'text-red-400',
    amber:   'text-amber-400',
    green:   'text-green-400',
    neutral: 'text-ghost-400',
  }
  return (
    <div className={`card ${toneStyles[tone]}`}>
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
        <Icon className={`w-3.5 h-3.5 ${iconColor[tone]}`} />
        {label}
      </div>
      <div className="text-xl font-semibold text-white">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}

interface PairCardProps {
  pair: BehaviorCorrelationPair
  expanded: boolean
  onToggle: () => void
}

function PairCard({ pair, expanded, onToggle }: PairCardProps) {
  return (
    <div className={`card border ${RISK_STYLES[pair.risk]}`}>
      <button
        className="w-full flex items-center gap-3 text-left"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {pair.profileAName}{' '}
            <span className="text-slate-500 mx-1">↔</span>{' '}
            {pair.profileBName}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Scanned {formatTimestamp(pair.computedAt)}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className={`text-lg font-semibold ${similarityColor(pair.similarity)}`}
          >
            {pair.similarityPercent.toFixed(1)}%
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            {pair.risk} risk
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-700/60 space-y-4">
          {/* Feature contributions */}
          <div className="grid grid-cols-3 gap-3">
            <FeatureBar
              icon={Keyboard}
              label="Typing"
              value={pair.featureContributions.typing}
            />
            <FeatureBar
              icon={MousePointer2}
              label="Mouse"
              value={pair.featureContributions.mouse}
            />
            <FeatureBar
              icon={ScrollText}
              label="Scroll"
              value={pair.featureContributions.scroll}
            />
          </div>

          {/* Recommendations */}
          {pair.recommendations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                <div className="text-xs font-medium text-slate-300">
                  Remediation
                </div>
              </div>
              <ul className="space-y-1.5">
                {pair.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-slate-300"
                  >
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-ghost-400 shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface FeatureBarProps {
  icon: React.ElementType
  label: string
  value: number // 0..1
}

function FeatureBar({ icon: Icon, label, value }: FeatureBarProps) {
  const pct = Math.round(value * 100)
  const color =
    value >= 0.9 ? 'bg-red-500' : value >= 0.75 ? 'bg-amber-500' : 'bg-ghost-500'
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3 h-3" />
          {label}
        </div>
        <div className="text-slate-300">{pct}%</div>
      </div>
      <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
