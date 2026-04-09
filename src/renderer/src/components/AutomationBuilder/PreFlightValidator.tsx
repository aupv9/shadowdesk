import React, { useMemo } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  X,
  Info,
  AlertTriangle,
  XCircle,
  Wrench,
  Zap,
  Loader2,
  Globe
} from 'lucide-react'
import type { HardenerIssue, HardenerSeverity, PreFlightValidationResult } from '../../types'
import { useHardenerStore } from '../../stores/hardenerStore'
import { useToastStore } from '../../stores/toastStore'

/**
 * Phase 17.H — Platform-Specific Detection Hardening
 *
 * Pre-flight validator card shown before a workflow run. Surfaces platform
 * detection, behavior/timing issues, and one-click fix buttons.
 *
 * Usage: rendered inside the AutomationBuilder's run controls. Hidden when
 * the hardener store has no pre-flight result.
 */

interface PreFlightValidatorProps {
  /** Current result to display. When null the component renders nothing. */
  result: PreFlightValidationResult | null
  /** Profile the fix buttons will patch */
  profileId: string | null
  /** Called when the user dismisses the card */
  onDismiss: () => void
  /** Called after the user clicks "Run anyway" (bypasses the block) */
  onRunAnyway?: () => void
  /** Called after the user clicks "Fix & run" (apply critical fix + run) */
  onFixAndRun?: () => void
}

const SEVERITY_META: Record<HardenerSeverity, {
  icon: React.ElementType
  label: string
  textClass: string
  bgClass: string
  borderClass: string
}> = {
  critical: {
    icon: XCircle,
    label: 'Critical',
    textClass: 'text-rose-300',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/30'
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warning',
    textClass: 'text-amber-300',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30'
  },
  info: {
    icon: Info,
    label: 'Info',
    textClass: 'text-sky-300',
    bgClass: 'bg-sky-500/10',
    borderClass: 'border-sky-500/30'
  }
}

const VERDICT_META = {
  ready: {
    icon: ShieldCheck,
    label: 'Ready to run',
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30'
  },
  warn: {
    icon: ShieldAlert,
    label: 'Tuning recommended',
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30'
  },
  block: {
    icon: ShieldX,
    label: 'Blocker detected',
    colorClass: 'text-rose-400',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/30'
  }
} as const

export function PreFlightValidator({
  result,
  profileId,
  onDismiss,
  onRunAnyway,
  onFixAndRun
}: PreFlightValidatorProps) {
  const applying = useHardenerStore((s) => s.applying)
  const applyFix = useHardenerStore((s) => s.applyFix)
  const pushToast = useToastStore((s) => s.push)

  // Group issues by severity for section rendering.
  const grouped = useMemo(() => {
    if (!result) return { critical: [], warning: [], info: [] } as Record<HardenerSeverity, HardenerIssue[]>
    const g: Record<HardenerSeverity, HardenerIssue[]> = { critical: [], warning: [], info: [] }
    for (const issue of result.issues) g[issue.severity].push(issue)
    return g
  }, [result])

  if (!result) return null

  const verdict = VERDICT_META[result.verdict]
  const VerdictIcon = verdict.icon

  const handleApplyFix = async (issue: HardenerIssue) => {
    if (!issue.suggestedFix || !profileId) return
    try {
      await applyFix(profileId, issue.suggestedFix)
      pushToast(`Applied: ${issue.suggestedFix.label}`, 'success')
    } catch (err: any) {
      pushToast(err?.message ?? 'Failed to apply fix', 'error')
    }
  }

  const handleApplyAllCritical = async () => {
    if (!profileId) return
    // Apply each critical fix in sequence so later ones see earlier patches.
    for (const issue of grouped.critical) {
      if (issue.suggestedFix) {
        try {
          await applyFix(profileId, issue.suggestedFix)
        } catch { /* keep going — surface last error via store.error */ }
      }
    }
    pushToast('Critical fixes applied', 'success')
    onFixAndRun?.()
  }

  return (
    <div className={`rounded-xl border ${verdict.borderClass} ${verdict.bgClass} p-4 mb-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <VerdictIcon className={`w-6 h-6 shrink-0 ${verdict.colorClass} mt-0.5`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-base font-semibold ${verdict.colorClass}`}>
                Pre-flight: {verdict.label}
              </h3>
              {result.platform && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-slate-800/80 text-slate-300">
                  <Globe className="w-3 h-3" />
                  {result.platform.platformName}
                  {result.platform.detectedRegion ? ` · ${result.platform.detectedRegion}` : ''}
                </span>
              )}
            </div>
            {result.platform?.summary && (
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {result.platform.summary}
              </p>
            )}
            {result.targetUrl && (
              <p className="text-[11px] text-slate-500 mt-1 truncate">
                Target: {result.targetUrl}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 text-slate-400 hover:text-white rounded transition-colors shrink-0"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Issue sections */}
      {(['critical', 'warning', 'info'] as HardenerSeverity[]).map((sev) => {
        const items = grouped[sev]
        if (items.length === 0) return null
        const meta = SEVERITY_META[sev]
        const Icon = meta.icon
        return (
          <div key={sev} className="mt-3 space-y-2">
            {items.map((issue) => (
              <div
                key={issue.code}
                className={`rounded-lg border ${meta.borderClass} ${meta.bgClass} p-3`}
              >
                <div className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${meta.textClass}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${meta.textClass}`}>
                        {issue.message}
                      </p>
                      <span className="text-[10px] uppercase tracking-wide text-slate-500 shrink-0">
                        {meta.label}
                      </span>
                    </div>
                    {issue.detail && (
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {issue.detail}
                      </p>
                    )}
                    {issue.suggestedFix && profileId && (
                      <button
                        onClick={() => handleApplyFix(issue)}
                        disabled={applying}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 disabled:opacity-50 transition-colors"
                      >
                        {applying ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wrench className="w-3 h-3" />
                        )}
                        {issue.suggestedFix.label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      })}

      {/* Tips */}
      {result.platform && result.platform.tips.length > 0 && (
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-ghost-400" />
            <span className="text-xs font-semibold text-slate-300">Platform tips</span>
          </div>
          <ul className="space-y-1">
            {result.platform.tips.map((tip, i) => (
              <li key={i} className="text-xs text-slate-400 flex gap-2">
                <span className="text-slate-600">•</span>
                <span className="flex-1">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer actions */}
      {result.verdict === 'block' && (
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
          {onRunAnyway && (
            <button
              onClick={onRunAnyway}
              className="text-xs px-3 py-1.5 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
            >
              Run anyway
            </button>
          )}
          {grouped.critical.some((i) => i.suggestedFix) && (
            <button
              onClick={handleApplyAllCritical}
              disabled={applying}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 disabled:opacity-50 transition-colors"
            >
              {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
              Apply critical fixes &amp; run
            </button>
          )}
        </div>
      )}
    </div>
  )
}