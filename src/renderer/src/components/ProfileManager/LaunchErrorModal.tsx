import React from 'react'
import { X, AlertCircle, ExternalLink, RefreshCw, Terminal } from 'lucide-react'

interface Props {
  profileName: string
  errorMessage: string
  onClose: () => void
  onRetry: () => void
}

export function LaunchErrorModal({ profileName, errorMessage, onClose, onRetry }: Props) {
  // Parse common errors into user-friendly messages
  const parsed = parseError(errorMessage)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-600/15">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Launch Failed</h3>
              <p className="text-xs text-slate-400 mt-0.5">Profile: {profileName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Friendly message */}
          <div>
            <p className="text-sm text-white font-medium mb-1">{parsed.title}</p>
            <p className="text-xs text-slate-400">{parsed.description}</p>
          </div>

          {/* Raw error (collapsible) */}
          <details className="group">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              Technical details
            </summary>
            <pre className="mt-2 text-xs text-red-300 bg-slate-900 rounded-lg p-3 overflow-auto max-h-32 border border-slate-700 font-mono">
              {errorMessage}
            </pre>
          </details>

          {/* Troubleshooting steps */}
          <div>
            <p className="text-xs font-medium text-slate-300 mb-2">Troubleshooting</p>
            <ul className="space-y-1.5">
              {parsed.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="text-slate-500 mt-0.5 shrink-0">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-700">
          <button onClick={onClose} className="btn-ghost text-xs px-4 py-2">
            Close
          </button>
          <button onClick={() => { onClose(); onRetry(); }} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Launch
          </button>
        </div>
      </div>
    </div>
  )
}

function parseError(msg: string): { title: string; description: string; steps: string[] } {
  const lower = msg.toLowerCase()

  if (lower.includes('enoent') || lower.includes('no such file') || lower.includes('chromium') || lower.includes('executable')) {
    return {
      title: 'Chromium browser not found',
      description: 'The Chromium executable could not be located on this system.',
      steps: [
        'Ensure Google Chrome or Chromium is installed on your system.',
        'Check that the browser path in Settings is correct.',
        'Try reinstalling Chrome if the problem persists.',
      ],
    }
  }

  if (lower.includes('eacces') || lower.includes('permission denied')) {
    return {
      title: 'Permission denied',
      description: 'The application does not have permission to launch the browser.',
      steps: [
        'Check file permissions on the Chromium executable.',
        'On macOS, ensure ShadowDesk has Accessibility permissions.',
        'Try running the application as administrator.',
      ],
    }
  }

  if (lower.includes('eaddrinuse') || lower.includes('port') || lower.includes('address already in use')) {
    return {
      title: 'Debug port conflict',
      description: 'The browser debug port is already in use by another process.',
      steps: [
        'Close any other running browser profiles.',
        'Check for other applications using Chrome debug ports (9222+).',
        'Restart the application to release orphaned ports.',
      ],
    }
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return {
      title: 'Browser launch timed out',
      description: 'The browser took too long to start. This can happen with slow disk I/O or large profiles.',
      steps: [
        'Try launching again — the profile data may need initial setup.',
        'Close unused applications to free system resources.',
        'If the profile has a large user-data directory, consider creating a fresh profile.',
      ],
    }
  }

  if (lower.includes('proxy') || lower.includes('err_proxy')) {
    return {
      title: 'Proxy connection failed',
      description: 'The assigned proxy could not be reached during browser startup.',
      steps: [
        'Test the proxy connection in the Proxy Manager.',
        'Verify proxy credentials are correct.',
        'Try launching the profile without a proxy to isolate the issue.',
      ],
    }
  }

  return {
    title: 'Unexpected launch error',
    description: msg.slice(0, 200),
    steps: [
      'Try launching the profile again.',
      'Check that your system meets the minimum requirements.',
      'If the error persists, try creating a new profile with the same preset.',
    ],
  }
}
