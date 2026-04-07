/**
 * Phase 16.C — Smart Selector Healing
 *
 * UI for manually triggering selector repair: paste a broken selector,
 * paste the page HTML, and get an AI-suggested replacement.
 */

import React, { useState } from 'react'
import {
  Wrench,
  Loader2,
  AlertCircle,
  CheckCircle,
  Copy,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import type { AiSelectorHealResult } from '../../types'

const CONFIDENCE_COLORS = {
  high:   'text-green-400 bg-green-500/10 border-green-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  low:    'text-red-400 bg-red-500/10 border-red-500/20'
}

export function SelectorHealer() {
  const [selector, setSelector]   = useState('')
  const [pageHtml, setPageHtml]   = useState('')
  const [context, setContext]     = useState('')
  const [healing, setHealing]     = useState(false)
  const [result, setResult]       = useState<AiSelectorHealResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)
  const [showHtml, setShowHtml]   = useState(false)
  const [history, setHistory]     = useState<AiSelectorHealResult[]>([])

  const handleHeal = async () => {
    if (!selector.trim() || !pageHtml.trim() || healing) return
    setHealing(true)
    setResult(null)
    setError(null)
    try {
      const res = await (window.api as any).ai.healSelector(
        selector.trim(),
        pageHtml,
        context || undefined
      )
      setResult(res)
      setHistory((prev) => [res, ...prev].slice(0, 10))
    } catch (e: any) {
      setError(e.message ?? 'Healing failed')
    } finally {
      setHealing(false)
    }
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-400">
        Paste a broken CSS selector and the current page HTML. The AI will suggest a working replacement.
      </div>

      {/* Broken selector */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Broken Selector</label>
        <input
          type="text"
          value={selector}
          onChange={(e) => setSelector(e.target.value)}
          placeholder="#username, .login-btn, [data-testid='submit']..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-ghost-500"
        />
      </div>

      {/* Context (optional) */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Context <span className="text-slate-600">(optional)</span>
        </label>
        <input
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. Login form submit button, search input field..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-ghost-500"
        />
      </div>

      {/* Page HTML */}
      <div>
        <button
          onClick={() => setShowHtml((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5"
        >
          {showHtml ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Page HTML snapshot
          {pageHtml && <span className="text-slate-600">({pageHtml.length.toLocaleString()} chars)</span>}
        </button>
        {showHtml && (
          <textarea
            value={pageHtml}
            onChange={(e) => setPageHtml(e.target.value)}
            placeholder="Paste the page HTML here (first ~8000 chars is ideal)..."
            rows={8}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono placeholder-slate-500 resize-y focus:outline-none focus:border-ghost-500"
          />
        )}
        {!showHtml && (
          <div
            onClick={() => setShowHtml(true)}
            className={`border border-dashed rounded-lg px-3 py-3 text-sm cursor-pointer transition-colors ${
              pageHtml
                ? 'border-ghost-500/40 text-ghost-400 hover:border-ghost-500/60'
                : 'border-slate-700 text-slate-500 hover:border-slate-600'
            }`}
          >
            {pageHtml ? 'HTML pasted — click to edit' : 'Click to paste page HTML'}
          </div>
        )}
      </div>

      {/* Heal button */}
      <button
        onClick={handleHeal}
        disabled={!selector.trim() || !pageHtml.trim() || healing}
        className="flex items-center gap-2 px-4 py-2 bg-ghost-600 hover:bg-ghost-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {healing
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Healing...</>
          : <><Wrench className="w-4 h-4" /> Heal Selector</>
        }
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`p-4 border rounded-lg ${CONFIDENCE_COLORS[result.confidence]}`}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium capitalize">{result.confidence} confidence</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 text-sm font-mono bg-black/20 rounded px-2 py-1.5 break-all">
              {result.suggestedSelector}
            </code>
            <button
              onClick={() => handleCopy(result.suggestedSelector)}
              className="shrink-0 p-1.5 rounded hover:bg-black/20 transition-colors"
              title="Copy selector"
            >
              {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs mt-2 opacity-80">{result.reasoning}</p>
        </div>
      )}

      {/* Selector history */}
      {history.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Recent heals</div>
          {history.map((h, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 rounded px-2 py-1.5">
              <span className="font-mono text-slate-500 truncate flex-1">{h.originalSelector}</span>
              <span className="text-slate-600">→</span>
              <span className="font-mono text-ghost-400 truncate flex-1">{h.suggestedSelector}</span>
              <button
                onClick={() => handleCopy(h.suggestedSelector)}
                className="shrink-0 hover:text-slate-200"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
