import React, { useState } from 'react'
import { X, Sparkles, Play, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'
import type { Profile, WarmUpResult } from '../../types'

interface Props {
  profile: Profile
  isActive: boolean
  onLaunch: () => Promise<void>
  onClose: () => void
}

const DEFAULT_SITES = [
  'https://www.google.com',
  'https://www.youtube.com',
  'https://en.wikipedia.org/wiki/Main_Page',
  'https://www.bing.com',
  'https://www.reddit.com',
  'https://www.amazon.com',
  'https://news.ycombinator.com'
]

export function WarmUpModal({ profile, isActive, onLaunch, onClose }: Props) {
  const [running, setRunning] = useState(false)
  const [result,  setResult]  = useState<WarmUpResult | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [sitesText, setSitesText] = useState(DEFAULT_SITES.join('\n'))

  const handleRun = async () => {
    setError(null)
    setResult(null)
    setRunning(true)
    try {
      // Profile must be running before warm-up — auto-launch if needed.
      if (!isActive) {
        await onLaunch()
      }
      const sites = sitesText.split('\n').map((s) => s.trim()).filter(Boolean)
      const r = await window.api.warmup.run(profile.id, sites.length > 0 ? sites : undefined)
      setResult(r)
    } catch (e: any) {
      setError(e.message ?? 'Warm-up failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <h2 className="text-base font-semibold text-white">Warm Up — {profile.name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}>&times;</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-xs text-slate-500 mb-4">
            "Cold" profiles look suspicious — no cookies, no history, no third-party trackers.
            Warm-up visits a list of common sites in sequence so the profile accumulates organic
            state real browsers carry. The profile will be launched if it's not already running.
          </p>

          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Sites to visit ({sitesText.split('\n').filter(Boolean).length})
            </label>
            <textarea
              className="input font-mono text-xs h-40 resize-none"
              value={sitesText}
              onChange={(e) => setSitesText(e.target.value)}
              disabled={running}
              placeholder="One URL per line"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Each site gets a 2–5 second dwell time. Profile is marked "warmed up" if ≥50% of sites load.
            </p>
          </div>

          <button
            onClick={handleRun}
            disabled={running}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-yellow-600/80 hover:bg-yellow-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {running ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Warming up…</>
            ) : (
              <><Play className="w-4 h-4" /> Start warm-up</>
            )}
          </button>

          {result && (
            <div className="mt-5 border border-slate-700 rounded-xl p-4 bg-slate-900/40">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">
                  {result.visited.filter((v) => v.success).length}/{result.visited.length} sites loaded
                </span>
                <span className="text-xs text-slate-500">{(result.durationMs / 1000).toFixed(1)}s total</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {result.visited.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {v.success
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    <span className="text-slate-300 flex-1 truncate" title={v.url}>{v.url}</span>
                    <span className="text-slate-600">{v.ms}ms</span>
                    {v.error && <span className="text-red-400 truncate max-w-[140px]" title={v.error}>{v.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
