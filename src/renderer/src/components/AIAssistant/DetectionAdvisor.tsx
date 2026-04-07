/**
 * Phase 16.B — AI Detection Advisor
 *
 * Sends the latest detection test result to the AI and displays
 * prioritized, actionable recommendations for improving the profile's score.
 */

import React, { useEffect, useState } from 'react'
import {
  Brain,
  Loader2,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Shield
} from 'lucide-react'
import type { AiDetectionAdvice, DetectionTestResult } from '../../types'

const RISK_COLORS = {
  low:    'text-green-400 bg-green-500/10 border-green-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  high:   'text-red-400 bg-red-500/10 border-red-500/20'
}

const PRIORITY_ICONS: Record<number, React.ElementType> = {
  1: AlertCircle,
  2: AlertTriangle,
  3: ChevronRight
}

const PRIORITY_COLORS: Record<number, string> = {
  1: 'text-red-400',
  2: 'text-amber-400',
  3: 'text-slate-400'
}

interface Props {
  latestResult: DetectionTestResult | null
  onNavigateToDetection: () => void
}

export function DetectionAdvisor({ latestResult, onNavigateToDetection }: Props) {
  const [analyzing, setAnalyzing]   = useState(false)
  const [advice, setAdvice]         = useState<AiDetectionAdvice | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [expanded, setExpanded]     = useState<Set<number>>(new Set([0]))

  // Auto-analyze when a result comes in
  const handleAnalyze = async () => {
    if (!latestResult || analyzing) return
    setAnalyzing(true)
    setError(null)
    try {
      const result = await (window.api as any).ai.analyzeDetection(
        latestResult.vectors,
        latestResult.overallScore
      )
      setAdvice(result)
      setExpanded(new Set([0]))
    } catch (e: any) {
      setError(e.message ?? 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleExpanded = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  if (!latestResult) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Shield className="w-12 h-12 text-slate-600 mb-3" />
        <div className="text-slate-400 text-sm mb-4">No detection test results yet.</div>
        <button
          onClick={onNavigateToDetection}
          className="flex items-center gap-2 text-sm text-ghost-400 hover:text-ghost-300"
        >
          <ArrowRight className="w-4 h-4" />
          Run a detection test first
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Latest result summary */}
      <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
        <div>
          <div className="text-sm font-medium text-white">{latestResult.profileName}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Score: {latestResult.overallScore}/100 · {latestResult.vectors.filter(v => !v.passed).length} vectors failing
          </div>
        </div>
        <div className={`text-sm font-medium px-3 py-1 rounded-full ${
          latestResult.status === 'passed'  ? 'bg-green-500/20 text-green-400' :
          latestResult.status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                                              'bg-red-500/20 text-red-400'
        }`}>
          {latestResult.status}
        </div>
      </div>

      {/* Analyze button */}
      <button
        onClick={handleAnalyze}
        disabled={analyzing}
        className="flex items-center gap-2 px-4 py-2 bg-ghost-600 hover:bg-ghost-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {analyzing
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing with AI...</>
          : <><Brain className="w-4 h-4" /> Analyze & Get Recommendations</>
        }
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Advice */}
      {advice && (
        <div className="space-y-4">
          {/* Summary + risk level */}
          <div className={`flex items-start gap-3 p-3 border rounded-lg ${RISK_COLORS[advice.riskLevel]}`}>
            <Brain className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium capitalize">{advice.riskLevel} risk</div>
              <div className="text-sm mt-0.5 opacity-90">{advice.overallSummary}</div>
            </div>
          </div>

          {/* Recommendations */}
          {advice.recommendations.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-400 p-3 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-4 h-4" />
              No major issues detected. Your profile looks good!
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                {advice.recommendations.length} Recommendation{advice.recommendations.length !== 1 ? 's' : ''}
              </div>
              {advice.recommendations.map((rec, idx) => {
                const Icon = PRIORITY_ICONS[rec.priority] ?? ChevronRight
                const isOpen = expanded.has(idx)
                return (
                  <div key={idx} className="border border-slate-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleExpanded(idx)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-800/50 transition-colors text-left"
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${PRIORITY_COLORS[rec.priority]}`} />
                      <span className="text-sm text-white flex-1">{rec.title}</span>
                      <span className="text-xs text-slate-500">P{rec.priority}</span>
                      {isOpen
                        ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                        : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      }
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-700/50 bg-slate-900/30 space-y-2">
                        <p className="text-sm text-slate-300">{rec.explanation}</p>

                        {rec.fieldPath && (
                          <div className="text-xs font-mono text-slate-400 bg-slate-800 rounded px-2 py-1">
                            Field: {rec.fieldPath}
                          </div>
                        )}
                        {rec.suggestedValue !== undefined && (
                          <div className="text-xs font-mono text-ghost-400 bg-slate-800 rounded px-2 py-1">
                            Suggested: {JSON.stringify(rec.suggestedValue)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
