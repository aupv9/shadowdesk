import React, { useState } from 'react'
import {
  X,
  Globe,
  Copy,
  Lightbulb,
  ExternalLink,
  BookOpen,
  Link as LinkIcon
} from 'lucide-react'

interface URLHelperProps {
  onSelect: (url: string) => void
  onClose: () => void
  /** Pre-fill the helper with an existing value so users can edit it */
  initialValue?: string
}

/**
 * Visual helper modal for URL fields (navigate, httpRequest, download, etc.).
 *
 * Provides:
 * - Common URL templates (login, search, API endpoints) with copy-and-use
 * - Guidance about protocol, query params, and variable substitution
 * - A quick-pick builder that lets the user compose a URL from parts
 * - Examples that accept Ghost Browser variable placeholders ({var})
 */
export function URLHelper({ onSelect, onClose, initialValue = '' }: URLHelperProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [protocol, setProtocol] = useState<'https' | 'http'>('https')
  const [host, setHost] = useState('')
  const [path, setPath] = useState('')
  const [query, setQuery] = useState('')

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 1500)
  }

  const handleUse = (url: string) => {
    handleCopy(url)
    onSelect(url)
  }

  const buildUrl = () => {
    if (!host) return ''
    const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''
    const cleanQuery = query ? (query.startsWith('?') ? query : `?${query}`) : ''
    return `${protocol}://${cleanHost}${cleanPath}${cleanQuery}`
  }

  const builtUrl = buildUrl()

  const templates = [
    {
      category: 'Webpage',
      urls: [
        'https://example.com',
        'https://example.com/login',
        'https://example.com/search?q=ghost+browser'
      ]
    },
    {
      category: 'API endpoints',
      urls: [
        'https://api.example.com/v1/users',
        'https://api.example.com/v1/items/{itemId}',
        'https://api.example.com/search?q={query}&limit=10'
      ]
    },
    {
      category: 'With workflow variables',
      urls: [
        'https://example.com/user/{username}',
        'https://example.com/product/{productId}',
        'https://api.example.com/session/{sessionToken}/data'
      ]
    }
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
        aria-labelledby="url-helper-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-ghost-400" />
            <h2 id="url-helper-title" className="text-lg font-semibold text-white">
              URL Helper
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
          {/* Tip */}
          <div className="mb-5 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-blue-200 space-y-1">
                <p className="text-blue-300 font-medium">Tips</p>
                <p>• Always include the protocol (https:// or http://)</p>
                <p>• Use <code className="text-blue-100 bg-slate-800 px-1 rounded">{'{varName}'}</code> to substitute workflow variables at runtime</p>
                <p>• Avoid trailing slashes unless the target page requires them</p>
              </div>
            </div>
          </div>

          {/* Quick builder */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-ghost-400" />
              Quick builder
            </h3>
            <div className="space-y-2 p-4 bg-slate-800/40 border border-slate-700/40 rounded-lg">
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <select
                  value={protocol}
                  onChange={(e) => setProtocol(e.target.value as 'https' | 'http')}
                  className="bg-slate-700 border border-slate-600 text-white text-xs rounded px-2 py-1.5"
                  aria-label="Protocol"
                >
                  <option value="https">https://</option>
                  <option value="http">http://</option>
                </select>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="example.com"
                  className="bg-slate-700 border border-slate-600 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500"
                  aria-label="Host"
                />
              </div>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/path/to/page (optional)"
                className="w-full bg-slate-700 border border-slate-600 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500"
                aria-label="Path"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="key=value&other=123 (optional)"
                className="w-full bg-slate-700 border border-slate-600 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ghost-500"
                aria-label="Query string"
              />

              {builtUrl && (
                <div className="flex items-center gap-2 pt-2">
                  <code className="flex-1 text-[11px] font-mono text-slate-200 bg-slate-900/80 border border-slate-700 px-2 py-1.5 rounded truncate">
                    {builtUrl}
                  </code>
                  <button
                    onClick={() => handleUse(builtUrl)}
                    className="px-3 py-1.5 bg-ghost-500 hover:bg-ghost-400 text-white text-xs font-medium rounded transition-colors"
                  >
                    Use
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Templates */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" />
              URL Templates
            </h3>
            <div className="space-y-3">
              {templates.map((group, idx) => (
                <div key={idx} className="border border-slate-700/50 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700/30">
                    <h4 className="text-xs font-semibold text-slate-300">{group.category}</h4>
                  </div>
                  <div className="bg-slate-900/50 p-3 space-y-2">
                    {group.urls.map((url, uIdx) => (
                      <div
                        key={uIdx}
                        className="flex items-center gap-2 p-2 rounded hover:bg-slate-800/50 transition-colors group/url"
                      >
                        <code className="flex-1 text-[11px] font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded border border-slate-700 truncate">
                          {url}
                        </code>
                        <button
                          onClick={() => handleUse(url)}
                          title="Copy and use"
                          className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors opacity-0 group-hover/url:opacity-100"
                          aria-label={`Use ${url}`}
                        >
                          {copied === url ? (
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

          {/* Initial value reference */}
          {initialValue && (
            <div className="p-3 bg-slate-800/40 border border-slate-700/40 rounded-lg">
              <p className="text-[10px] text-slate-400 mb-1">Current value</p>
              <code className="text-[11px] font-mono text-slate-200 break-all">{initialValue}</code>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700/60 bg-slate-900/80 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Click a template to auto-fill the URL field
          </p>
          <a
            href="https://developer.mozilla.org/en-US/docs/Web/API/URL"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-ghost-400 hover:text-ghost-300 transition-colors"
          >
            URL reference
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
