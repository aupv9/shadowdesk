import React, { useState } from 'react'
import {
  X,
  Eye,
  Zap,
  Copy,
  ExternalLink,
  ChevronDown,
  Lightbulb,
  BookOpen,
  Code
} from 'lucide-react'

interface SelectorHelperProps {
  onSelect: (selector: string) => void
  onClose: () => void
}

export function SelectorHelper({ onSelect, onClose }: SelectorHelperProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = (selector: string) => {
    navigator.clipboard.writeText(selector)
    setCopied(selector)
    setTimeout(() => setCopied(null), 2000)
  }

  const commonSelectors = [
    { category: 'By ID', selectors: ['#login', '#submit-btn', '#email-field'] },
    { category: 'By Class', selectors: ['.button', '.login-btn', '.primary'] },
    { category: 'By Type', selectors: ['input[type="text"]', 'button[type="submit"]', 'input[type="email"]'] },
    { category: 'By Name', selectors: ['input[name="username"]', 'input[name="password"]', 'select[name="country"]'] },
    { category: 'By Attribute', selectors: ['[aria-label="Close"]', '[data-testid="login"]', '[role="button"]'] },
    { category: 'Combinations', selectors: ['.form > button.submit', 'form#login input[type="text"]', '.modal .close-btn'] }
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="selector-helper-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-ghost-400" />
            <h2
              id="selector-helper-title"
              className="text-lg font-semibold text-white"
            >
              CSS Selector Helper
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Tips */}
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="text-blue-300 font-medium mb-1">💡 How to find selectors</p>
                <ol className="text-blue-200 text-xs space-y-1">
                  <li>1. Open your browser's DevTools (F12)</li>
                  <li>2. Click the Inspector/Elements tab</li>
                  <li>3. Right-click the element → Inspect (or click the inspector icon)</li>
                  <li>4. Copy the selector from examples below, or use the HTML structure to build one</li>
                  <li>5. Paste it here and validate</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Common Patterns */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Common Selector Patterns
            </h3>

            <div className="space-y-3">
              {commonSelectors.map((group, idx) => (
                <div key={idx} className="border border-slate-700/50 rounded-lg overflow-hidden">
                  {/* Category header */}
                  <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700/30">
                    <h4 className="text-xs font-semibold text-slate-300">{group.category}</h4>
                  </div>

                  {/* Selectors */}
                  <div className="bg-slate-900/50 p-3 space-y-2">
                    {group.selectors.map((selector, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-center gap-2 p-2 rounded hover:bg-slate-800/50 transition-colors group/selector"
                      >
                        <code className="flex-1 text-xs font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded border border-slate-700 truncate">
                          {selector}
                        </code>
                        <button
                          onClick={() => {
                            handleCopy(selector)
                            onSelect(selector)
                          }}
                          title="Copy and select"
                          className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded transition-colors opacity-0 group-hover/selector:opacity-100"
                        >
                          {copied === selector ? (
                            <span className="text-green-400 text-xs">✓</span>
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Best Practices */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-emerald-300 font-medium text-xs mb-2">✓ Best Practices</p>
                <ul className="text-emerald-200 text-[10px] space-y-1">
                  <li>• <strong>Prefer class selectors</strong> (.button) over IDs (#id) when possible</li>
                  <li>• <strong>Avoid deep nesting</strong> (more than 3 levels is fragile)</li>
                  <li>• <strong>Use data attributes</strong> ([data-testid="..."]) for testing</li>
                  <li>• <strong>Test your selector</strong> in DevTools console: <code className="bg-slate-800 px-1 rounded text-[9px]">document.querySelector('...')</code></li>
                  <li>• <strong>Make it specific</strong> but not brittle—avoid generated IDs/classes</li>
                </ul>
              </div>
            </div>
          </div>

          {/* CSS Selector Syntax Reference */}
          <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Code className="w-4 h-4 text-slate-400" />
              <h4 className="text-sm font-semibold text-slate-300">CSS Selector Syntax Reference</h4>
            </div>

            <div className="space-y-2 text-[10px] text-slate-400 font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-300 font-semibold mb-1">Selector</p>
                  <p className="mb-1">.class</p>
                  <p className="mb-1">#id</p>
                  <p className="mb-1">element</p>
                  <p className="mb-1">[attr="val"]</p>
                </div>
                <div>
                  <p className="text-slate-300 font-semibold mb-1">Meaning</p>
                  <p className="mb-1">Select by class name</p>
                  <p className="mb-1">Select by ID</p>
                  <p className="mb-1">Select by element (div, button, etc)</p>
                  <p className="mb-1">Select by attribute</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-700/50">
                <p className="text-slate-300 font-semibold mb-1">Combinators</p>
                <p className="mb-1">A B {'\u2014'} B inside A (descendant)</p>
                <p className="mb-1">A {'>'} B {'\u2014'} B direct child of A</p>
                <p className="mb-1">A + B {'\u2014'} B adjacent to A</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700/60 bg-slate-900/80 space-y-2">
          <p className="text-xs text-slate-500">
            💡 Tip: Click a selector above to copy it and use it in your step
          </p>
          <a
            href="https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-ghost-400 hover:text-ghost-300 transition-colors"
          >
            Learn more about CSS selectors
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
