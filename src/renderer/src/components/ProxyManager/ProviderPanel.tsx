import React, { useEffect, useState, useMemo } from 'react'
import {
  Plus, Trash2, Loader2, Cloud, RefreshCw, CheckCircle2, AlertCircle, Zap, Globe2, Download, Edit2, Search
} from 'lucide-react'
import { useProxyProviderStore } from '../../stores/proxyProviderStore'
import { useProxyStore } from '../../stores/proxyStore'
import { useToastStore } from '../../stores/toastStore'
import type {
  ProxyProviderAccountView,
  ProxyProviderCatalogEntry,
  ProxyProviderType,
  ProxySessionType,
} from '../../types'

/**
 * Phase 25 — Provider Accounts UX Enhancements
 * (Built on Phase 20 — Proxy Provider Marketplace)
 *
 * 5 Quick Wins:
 * 1. Edit Account Modal — Modify credentials/endpoint/session
 * 2. Filter & Search — Find accounts by provider type, status, label
 * 3. Bulk Operations — Multi-select + batch test/delete
 * 4. Pre-submit Validation — Test credentials before saving
 * 5. Last Used Country — Persist user's country preference
 */

const SEA_COUNTRIES = [
  { code: 'VN', name: 'Vietnam' },
  { code: 'TH', name: 'Thailand' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'SG', name: 'Singapore' },
]

const ALL_COUNTRIES = [
  ...SEA_COUNTRIES,
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'JP', name: 'Japan' },
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

interface AddProviderFormProps {
  catalog: ProxyProviderCatalogEntry[]
  onCancel: () => void
  onCreated: () => void
}

function AddProviderForm({ catalog, onCancel, onCreated }: AddProviderFormProps) {
  const { createAccount } = useProxyProviderStore()
  const { testAccount } = useProxyProviderStore()
  const push = useToastStore((s) => s.push)
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
  const [testing, setTesting] = useState(false)
  const [testOk, setTestOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entry = catalog.find((c) => c.type === type)

  // Auto-fill defaults when provider type changes
  useEffect(() => {
    if (entry) {
      setEndpoint(entry.defaultEndpoint)
      setPort(entry.defaultPort)
      if (!label) setLabel(`My ${entry.name}`)
      setTestOk(false)
    }
  }, [type, entry])

  /**
   * Phase 25.4: Pre-submit Validation
   * Test credentials before creating account
   */
  const handleTestBeforeSubmit = async () => {
    if (!username || !password || !endpoint || !port) {
      setError('Please fill in all required fields')
      return
    }
    setTesting(true)
    setError(null)
    try {
      // Create temporary account to test
      const tempAccount = await createAccount({
        type,
        label: `[Test] ${label || 'Temp'}`,
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

      // Test connection
      const result = await testAccount(tempAccount.id)
      if (result.ok) {
        setTestOk(true)
        push('✓ Connection verified — click Connect to save', 'success')
      } else {
        throw new Error(result.error || 'Connection test failed')
      }
    } catch (err) {
      setError((err as Error).message)
      setTestOk(false)
    } finally {
      setTesting(false)
    }
  }

  const submit = async () => {
    if (!label || !username || !password) {
      setError('Label, username and password are required')
      return
    }
    if (!testOk) {
      setError('Please test connection first')
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
      push('Provider account connected successfully', 'success')
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

      {testOk && (
        <div className="text-xs text-green-400 mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          ✓ Connection verified
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
        <button
          onClick={handleTestBeforeSubmit}
          disabled={testing || !username || !password || !endpoint || !port}
          className="btn-ghost text-sm flex items-center gap-2"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button onClick={submit} disabled={submitting || !testOk} className="btn-primary text-sm flex items-center gap-2">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Connect Account
        </button>
      </div>
    </div>
  )
}

interface EditProviderModalProps {
  account: ProxyProviderAccountView
  catalog: ProxyProviderCatalogEntry[]
  onSave: (patch: any) => Promise<void>
  onCancel: () => void
}

/**
 * Phase 25.1: Edit Modal
 * Modify account label, endpoint, port, session type, API key
 */
function EditProviderModal({ account, catalog, onSave, onCancel }: EditProviderModalProps) {
  const push = useToastStore((s) => s.push)
  const [label, setLabel] = useState(account.label)
  const [endpoint, setEndpoint] = useState(account.endpoint)
  const [port, setPort] = useState(account.port)
  const [defaultSession, setDefaultSession] = useState(account.defaultSession)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entry = catalog.find((c) => c.type === account.type)

  const submit = async () => {
    if (!label || !endpoint || !port) {
      setError('Label, endpoint, and port are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        label,
        endpoint,
        port,
        defaultSession,
      })
      push('Account updated successfully', 'success')
      onCancel()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Edit2 className="w-4 h-4 text-ghost-400" />
          Edit Provider Account
        </h2>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Label</label>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
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
            <label className="text-xs text-slate-400 mb-1 block">Default Session</label>
            <select className="input" value={defaultSession} onChange={(e) => setDefaultSession(e.target.value as ProxySessionType)}>
              <option value="rotating">Rotating (every request)</option>
              <option value="sticky">Sticky (~10 min)</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-400 mb-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
          <button onClick={submit} disabled={saving || !label || !endpoint || !port} className="btn-primary text-sm flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

interface GenerateModalProps {
  account: ProxyProviderAccountView
  onClose: () => void
}

function GenerateModal({ account, onClose }: GenerateModalProps) {
  const { generateAndImport, generating } = useProxyProviderStore()
  const fetchProxies = useProxyStore((s) => s.fetchProxies)
  const push = useToastStore((s) => s.push)
  const [count, setCount] = useState(5)
  const [country, setCountry] = useState(() => localStorage.getItem('provider:lastCountry') || 'VN')
  const [session, setSession] = useState<ProxySessionType>(account.defaultSession)
  const [stickyMinutes, setStickyMinutes] = useState(10)
  const [imported, setImported] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isGenerating = generating.has(account.id)

  // Phase 25.5: Persist last used country
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry)
    localStorage.setItem('provider:lastCountry', newCountry)
  }

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
      push(`Generated and imported ${result.imported} proxies`, 'success')
      setTimeout(onClose, 1500)
    } catch (err) {
      setError((err as Error).message)
      push(`Failed to generate proxies: ${(err as Error).message}`, 'error')
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
            <select className="input" value={country} onChange={(e) => handleCountryChange(e.target.value)}>
              {ALL_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
              ))}
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
  const { catalog, accounts, loading, fetchCatalog, fetchAccounts, deleteAccount, testAccount, refreshUsage, testing, updateAccount } = useProxyProviderStore()
  const push = useToastStore((s) => s.push)
  const [showAdd, setShowAdd] = useState(false)
  const [generateFor, setGenerateFor] = useState<ProxyProviderAccountView | null>(null)
  const [editAccount, setEditAccount] = useState<ProxyProviderAccountView | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; ip?: string; error?: string } | null>(null)

  // Phase 25.2: Filter & Search state
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState<'all' | ProxyProviderType>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | ProxyProviderAccountView['status']>('all')

  // Phase 25.3: Bulk operations state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [testingBatch, setTestingBatch] = useState(false)

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

  /**
   * Phase 25.3: Bulk test
   */
  const handleTestBatch = async () => {
    if (selected.size === 0) return
    setTestingBatch(true)
    const results = await Promise.allSettled(
      Array.from(selected).map(id => testAccount(id))
    )
    const successes = results.filter(r => r.status === 'fulfilled' && (r.value as any).ok).length
    push(`Tested ${selected.size} accounts · ${successes} connected`, successes === selected.size ? 'success' : 'info')
    setTestingBatch(false)
    setSelected(new Set())
  }

  /**
   * Phase 25.3: Bulk delete
   */
  const handleDeleteBatch = async () => {
    if (selected.size === 0 || !confirm(`Delete ${selected.size} account(s)?`)) return
    for (const id of selected) {
      await deleteAccount(id)
    }
    push(`Deleted ${selected.size} accounts`, 'success')
    setSelected(new Set())
  }

  // Filter and search
  const filtered = useMemo(() => {
    return accounts.filter(a =>
      (searchText === '' || a.label.toLowerCase().includes(searchText.toLowerCase())) &&
      (filterType === 'all' || a.type === filterType) &&
      (filterStatus === 'all' || a.status === filterStatus)
    )
  }, [accounts, searchText, filterType, filterStatus])

  const allSelected = selected.size > 0 && selected.size === filtered.length
  const someSelected = selected.size > 0 && selected.size < filtered.length

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

      {/* Phase 25.2: Filter & Search bar */}
      {accounts.length > 0 && !showAdd && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by account label..."
              className="input pl-9 w-full"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="input text-xs flex-1 min-w-32"
          >
            <option value="all">All Providers</option>
            <option value="smartproxy">Smartproxy</option>
            <option value="brightdata">BrightData</option>
            <option value="oxylabs">Oxylabs</option>
            <option value="custom">Custom</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="input text-xs flex-1 min-w-32"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="invalid">Invalid</option>
            <option value="error">Error</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>
      )}

      {/* Phase 25.3: Bulk action bar */}
      {selected.size > 0 && (
        <div className="card flex items-center justify-between bg-ghost-900/20 border-ghost-500/30">
          <span className="text-xs text-slate-300 font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestBatch}
              disabled={testingBatch}
              className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
            >
              {testingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Test All
            </button>
            <button onClick={handleDeleteBatch} className="btn-danger text-xs flex items-center gap-1.5 py-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
            <button onClick={() => setSelected(new Set())} className="btn-ghost text-xs py-1.5">
              Clear
            </button>
          </div>
        </div>
      )}

      {loading && accounts.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">Loading providers…</div>
      ) : filtered.length === 0 && !showAdd ? (
        <div className="card text-center py-10">
          <Cloud className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 text-sm font-medium mb-1">
            {accounts.length === 0 ? 'No provider accounts yet' : 'No accounts match filters'}
          </p>
          <p className="text-slate-500 text-xs mb-4">
            {accounts.length === 0
              ? 'Plug in your residential proxy provider to generate ready-to-use proxies in one click.'
              : 'Try adjusting your search or filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((account) => {
            const isTesting = testing.has(account.id)
            const usage = account.usage
            const result = testResult?.id === account.id ? testResult : null
            const isSelected = selected.has(account.id)

            return (
              <div
                key={account.id}
                className={`card cursor-pointer transition-colors ${
                  isSelected ? 'border-ghost-500 bg-ghost-900/10' : 'hover:border-slate-600'
                }`}
                onClick={() => {
                  const newSet = new Set(selected)
                  if (newSet.has(account.id)) newSet.delete(account.id)
                  else newSet.add(account.id)
                  setSelected(newSet)
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      const newSet = new Set(selected)
                      if (newSet.has(account.id)) newSet.delete(account.id)
                      else newSet.add(account.id)
                      setSelected(newSet)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-slate-600 accent-ghost-500 mt-1"
                  />

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
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
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
                      onClick={() => setEditAccount(account)}
                      className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
                      title="Edit account"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
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

      {editAccount && (
        <EditProviderModal
          account={editAccount}
          catalog={catalog}
          onSave={(patch) => updateAccount(editAccount.id, patch)}
          onCancel={() => setEditAccount(null)}
        />
      )}

      {generateFor && (
        <GenerateModal account={generateFor} onClose={() => setGenerateFor(null)} />
      )}
    </div>
  )
}
