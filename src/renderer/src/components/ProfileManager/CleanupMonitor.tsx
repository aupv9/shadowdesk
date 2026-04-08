import React, { useEffect } from 'react'
import { Trash2, RefreshCw, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react'
import { useCleanupStore } from '../../stores/cleanupStore'

/**
 * Phase 3: Cleanup Worker Progress Monitor
 *
 * Displays real-time status of the async cleanup worker:
 * - Queued tasks
 * - Currently processing tasks
 * - Failed tasks
 * - Retry / clear failed actions
 *
 * Shows as a floating widget when there are active tasks,
 * or can be accessed via a settings panel.
 */

export function CleanupMonitor() {
  const { status, startPolling, stopPolling, retryFailed, clearFailed } = useCleanupStore()

  useEffect(() => {
    startPolling(3000)
    return () => stopPolling()
  }, [])

  const hasActivity = status.total > 0 || status.failed > 0

  if (!hasActivity) return null

  const isProcessing = status.processing > 0 || status.queued > 0
  const hasFailed = status.failed > 0

  return (
    <div className="fixed bottom-6 right-6 z-40 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-b border-slate-700">
        <div className="flex items-center gap-2">
          {isProcessing ? (
            <Loader2 className="w-4 h-4 text-ghost-400 animate-spin" />
          ) : hasFailed ? (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          )}
          <span className="text-sm font-medium text-white">
            Profile Cleanup
          </span>
        </div>
        <span className="text-xs text-slate-400">
          {status.total} task{status.total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Status breakdown */}
      <div className="px-4 py-3 space-y-2">
        {status.queued > 0 && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <span>Queued</span>
            </div>
            <span className="text-white font-medium">{status.queued}</span>
          </div>
        )}

        {status.processing > 0 && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Processing</span>
            </div>
            <span className="text-white font-medium">{status.processing}</span>
          </div>
        )}

        {status.failed > 0 && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-red-400">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span>Failed</span>
            </div>
            <span className="text-red-400 font-medium">{status.failed}</span>
          </div>
        )}
      </div>

      {/* Progress bar for active tasks */}
      {isProcessing && (
        <div className="px-4 pb-3">
          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-ghost-500 transition-all duration-300"
              style={{
                width: `${
                  status.total > 0
                    ? ((status.processing / (status.processing + status.queued)) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Actions for failed tasks */}
      {hasFailed && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-700">
          <button
            onClick={() => retryFailed().catch(() => {})}
            className="btn-ghost text-xs flex items-center gap-1.5 flex-1 justify-center"
            title="Retry all failed cleanups"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
          <button
            onClick={() => clearFailed().catch(() => {})}
            className="text-xs flex items-center gap-1.5 flex-1 justify-center px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-600/20 transition-colors"
            title="Clear failed cleanup records"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
