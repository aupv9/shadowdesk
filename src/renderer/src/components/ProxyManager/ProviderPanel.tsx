import React, { useEffect, useState } from 'react'
import {
  Plus, Trash2, Loader2, Cloud, RefreshCw, CheckCircle2, AlertCircle, Zap, Globe2, Download
} from 'lucide-react'
import { useProxyProviderStore } from '../../stores/proxyProviderStore'
import { useProxyStore } from '../../stores/proxyStore'
import type {
  ProxyProviderAccountView,
  ProxyProviderCatalogEntry,
  ProxyProviderType,
  ProxySessionType,
} from '../../types'

/**
 * Phase 20 — Proxy Provider Marketplace UI
 * (User-facing label: "Phase 17 — Proxy API Integration")
 *
 * Lets users plug their existing residential proxy account credentials into
 * Ghost Browser and generate ready-to-use proxies on demand without ever
 * touching host:port:user:pass strings.
 */

const SEA_COUNTRIES = [
  { code: 'VN', name: 'Vietnam' },
  { code: 'TH', name: 'Thailand' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'SG', name: 'Singapore' },
]

function StatusBadge({ status }: { status: ProxyProviderAccountView['status'] }) {
  const config = {
    unverified: { label: 'Unverified', color: 'bg-slate-700 text-slate-300' },
    active:     { label: 'Active',     color: 'bg-green-900/50 text-green-300' },
    invalid:    { label: 'Invalid',    color: 'bg-red-900/50 text-red-300' },
    error:      { label: 'Error',      color: 'bg-amber-900/50 text-amber-300' },
  }[status]
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${config.color}`}>
      {config.label}
    </span>
  )
}

function AddProviderForm({
  catalog,
  onCancel,
  onCreated,
}: {
  catalog: ProxyProviderCatalogEntry[]
  onCancel: () => void
  onCreated: () => void
}) {
  const { createAccount } = useProxyProviderStore()
  const [type, setType] = useState<ProxyProviderType>('smartproxy')
  const [label, setLabel] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [port, setPort] = useState<number>(0)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [zone, setZone] = useState('')
  const [defaultSession, setDefaultSession] = useState<ProxySessionType>('rotating')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entry = catalog.find((c) => c.type === type)

  // Auto-fill defaults when provider type changes
  useEffect(() => {
    if (entry) {
      setEndpoint(entry.defaultEndpoint)
      setPort(entry.defaultPort)
      if (!label) setLabel(`My ${entry.name}`)
    }
  }, [type])

  const submit = async () => {
    if (!label || !username || !password) {
      setError('Label, username and password are required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await createAccount({
        type,
        label,
        endpoint: endpoint || undefined,
        port: port || undefined,
        defaultPool: 'residential',
        defaultSession,
        credentials: {
          username,
          password,
          apiKey: apiKey || undefined,
          zone: zone || undefined,
        },
      })
      onCreated()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card mb-4 border-ghost-600/40">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Cloud className="w-4 h-4 text-ghost-400" />
        Connect Provider Account
      </h3>

      {/* Provider type picker */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {catalog.map((c) => (
          <button
            key={c.type}
            type="button"
            onClick={() => setType(c.type)}
            className={`p-3 rounded-lg border text-left transition-colors ${
              type === c.type
                ? 'border-ghost-500 bg-ghost-900/30'
                : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
            }`}
          >
            <div className="text-sm font-medium text-white">{c.name}</div>
            <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{c.description.split('.')[0]}</div>
            {c.supportsSeaRegions && (
              <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                <Globe2 className="w-3 h-3" /> SEA pools
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Account fields */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Account Label</label>
          <input className="input" placeholder="My Smartproxy" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Default Session</label>
          <select className="input" value={defaultSession} onChange={(e) => setDefaultSession(e.target.value as ProxySessionType)}>
            <option value="rotating">Rotating (every request)</option>
            <option value="sticky">Sticky (~10 min)</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Gateway Host</label>
          <input className="input font-mono text-xs" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Port</label>
          <input className="input font-mono text-xs" type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Username</label>
          <input className="input" placeholder="user" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Password</label>
          <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {type === 'brightdata' && (
          <div className="col-span-2">
            <label className="text-xs text-slate-400 mb-1 block">Zone (BrightData only)</label>
            <input className="input" placeholder="residential_proxy1" value={zone} onChange={(e) => setZone(e.target.value)} />
          </div>
        )}
        {entry?.hasUsageApi && (
          <div className="col-span-2">
            <label className="text-xs text-slate-400 mb-1 block">
              API Key <span className="text-slate-500">(optional — enables usage stats)</span>
            </label>
            <input className="input" type="password" placeholder="API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400 mb-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
        <button onClick={submit} disabled={submitting} className="btn-primary text-sm flex items-center gap-2">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Connect Account
        </button>
      </div>
    </div>
  )
}

function GenerateModal({
  account,
  onClose,
}: {
  account: ProxyProviderAccountView
  onClose: () => void
}) {
  const { generateAndImport, generating } = useProxyProviderStore()
  const fetchProxies = useProxyStore((s) => s.fetchProxies)
  const [count, setCount] = useState(5)
  const [country, setCountry] = useState('VN')
  const [session, setSession] = useState<ProxySessionType>(account.defaultSession)
  const [stickyMinutes, setStickyMinutes] = useState(10)
  const [imported, setImported] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isGenerating = generating.has(account.id)

  const submit = async () => {
    setError(null)
    setImported(null)
    try {
      const result = await generateAndImport(account.id, {
        count,
        country,
        session,
        stickyMinutes: session === 'sticky' ? stickyMinutes : undefined,
      })
      setImported(result.imported)
      // Refresh the regular proxy list so the new entries show up.
      await fetchProxies()
      setTimeout(onClose, 1500)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <Zap className="w-4 h-4 text-ghost-400" />
          Generate Proxies
        </h2>
        <p className="text-xs text-slate-400 mb-4">From {account.label} ({account.catalog.name})</p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">How many proxies?</label>
            <input
              className="input"
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value))))}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Target country</label>
            <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
              {SEA_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
              ))}
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="DE">Germany</option>
              <option value="JP">Japan</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Session type</label>
            <select className="input" value={session} onChange={(e) => setSession(e.target.value as ProxySessionType)}>
              <option value="rotating">Rotating — fresh IP each request</option>
              <option value="sticky">Sticky — same IP for N minutes</option>
            </select>
          </div>
          {session === 'sticky' && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Sticky duration (minutes)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={30}
                value={stickyMinutes}
                onChange={(e) => setStickyMinutes(Number(e.target.value))}
              />
            </div>
          )}
        </div>

        {imported !== null && (
          <div className="text-sm text-green-400 mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Imported {imported} proxies into the local pool
          </div>
        )}
        {error && (
          <div className="text-xs text-red-400 mb-3 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={submit} disabled={isGenerating} className="btn-primary text-sm flex items-center gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Generate & Import
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProviderPanel() {
  const { catalog, accounts, loading, fetchCatalog, fetchAccounts, deleteAccount, testAccount, refreshUsage, testing } = useProxyProviderStore()
  const [showAdd, setShowAdd] = useState(false)
  const [generateFor, setGenerateFor] = useState<ProxyProviderAccountView | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; ip?: string; error?: string } | null>(null)

  useEffect(() => {
    fetchCatalog()
    fetchAccounts()
  }, [])

  const runTest = async (account: ProxyProviderAccountView) => {
    try {
      const result = await testAccount(account.id)
      setTestResult({
        id: account.id,
        ok: result.ok,
        ip: result.exitIp,
        error: result.error,
      })
      setTimeout(() => setTestResult(null), 5000)
    } catch (err) {
      setTestResult({ id: account.id, ok: false, error: (err as Error).message })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Provider Accounts</h2>
          <p className="text-xs text-slate-400">
            Connect Smartproxy / BrightData / Oxylabs and generate proxies on demand.
          </p>
        </div>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Provider
          </button>
        )}
      </div>

      {showAdd && (
        <AddProviderForm
          catalog={catalog}
          onCancel={() => setShowAdd(false)}
          onCreated={() => setShowAdd(false)}
        />
      )}

      {loading && accounts.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">Loading providers…</div>
      ) : accounts.length === 0 && !showAdd ? (
        <div className="card text-center py-10">
          <Cloud className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 text-sm font-medium mb-1">No provider accounts yet</p>
          <p className="text-slate-500 text-xs mb-4">
            Plug in your residential proxy provider to generate ready-to-use proxies in one click.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => {
            const isTesting = testing.has(account.id)
            const usage = account.usage
            const result = testResult?.id === account.id ? testResult : null
            return (
              <div key={account.id} className="card">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-ghost-900/30 border border-ghost-700/40 flex items-center justify-center shrink-0">
                    <Cloud className="w-5 h-5 text-ghost-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-white">{account.label}</span>
                      <StatusBadge status={account.status} />
                      <span className="text-[10px] text-slate-500 uppercase">{account.catalog.name}</span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      {account.endpoint}:{account.port} · {account.defaultSession}
                    </div>
                    {usage && (
                      <div className="text-[11px] text-slate-400 mt-1">
                        {usage.bandwidthGbUsed != null && usage.bandwidthGbTotal != null ? (
                          <>
                            {usage.bandwidthGbUsed.toFixed(2)} / {usage.bandwidthGbTotal.toFixed(2)} GB used
                          </>
                        ) : usage.bandwidthGbUsed != null ? (
                          <>{usage.bandwidthGbUsed.toFixed(2)} GB used</>
                        ) : null}
                        {usage.planName && <span className="ml-2 text-slate-500">· {usage.planName}</span>}
                      </div>
                    )}
                    {result && (
                      <div className={`text-xs mt-1.5 flex items-center gap-1.5 ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                        {result.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        {result.ok
                          ? <>Connected · exit IP {result.ip ?? 'unknown'}</>
                          : <>Failed: {result.error ?? 'unknown error'}</>
                        }
                      </div>
                    )}
                    {!result && account.lastError && account.status === 'invalid' && (
                      <div className="text-xs text-red-400 mt-1.5 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {account.lastError}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => runTest(account)}
                      disabled={isTesting}
                      className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
                      title="Test connection"
                    >
                      {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Test
                    </button>
                    {account.catalog.hasUsageApi && account.hasApiKey && (
                      <button
                        onClick={() => refreshUsage(account.id)}
                        className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
                        title="Refresh usage stats"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setGenerateFor(account)}
                      className="btn-primary text-xs flex items-center gap-1.5 py-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Generate
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Disconnect "${account.label}"? This won't delete proxies you already imported.`)) {
                          deleteAccount(account.id)
                        }
                      }}
                      className="p-2 rounded-lg text-slate-500 hover:bg-red-600/20 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {generateFor && (
        <GenerateModal account={generateFor} onClose={() => setGenerateFor(null)} />
      )}
    </div>
  )
}
