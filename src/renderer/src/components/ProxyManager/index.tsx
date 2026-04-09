import React, { useEffect, useState, useMemo } from 'react'
import { Plus, Trash2, Wifi, WifiOff, Loader2, Globe, Upload, Cloud, ListFilter, Edit2, Copy, Eye, EyeOff, ArrowUpDown, ChevronDown } from 'lucide-react'
import { useProxyStore } from '../../stores/proxyStore'
import { useToastStore } from '../../stores/toastStore'
import { Header } from '../Layout/Header'
import type { CreateProxyInput, ProxyConfig, UpdateProxyInput } from '../../types'
import { ProviderPanel } from './ProviderPanel'

type ProxyTab = 'pool' | 'providers'
type SortField = 'name' | 'host' | 'latency' | 'health' | 'created'
type SortOrder = 'asc' | 'desc'

function AddProxyForm({ onAdd, onCancel }: { onAdd: (v: CreateProxyInput) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState<CreateProxyInput>({
    name: '',
    type: 'http',
    host: '',
    port: 8080,
    username: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const set = (k: keyof CreateProxyInput, v: any) => setForm((f) => ({ ...f, [k]: v }))

  // Smart paste: detect format from pasted text
  const handleHostPaste = (text: string) => {
    const trimmed = text.trim()
    // Try to detect format: [type:]host:port[:user[:pass]]
    const parts = trimmed.split(':')
    let idx = 0
    let type = 'http'

    if (['http', 'https', 'socks5'].includes(parts[0]?.toLowerCase())) {
      type = parts[0].toLowerCase()
      idx = 1
    }

    const host = parts[idx]
    const port = parts[idx + 1] ? parseInt(parts[idx + 1], 10) : 8080
    const user = parts[idx + 2] || ''
    const pass = parts[idx + 3] || ''

    if (host && !isNaN(port)) {
      set('type', type as any)
      set('host', host)
      set('port', port)
      if (user) set('username', user)
      if (pass) set('password', pass)
    }
  }

  const submit = async () => {
    if (!form.host || !form.name) return
    setLoading(true)
    try {
      await onAdd({ ...form, username: form.username || undefined, password: form.password || undefined })
      onCancel()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card mb-4 border-ghost-600/40">
      <h3 className="text-sm font-semibold text-white mb-4">Add Proxy</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Label</label>
          <input className="input" placeholder="My Proxy" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Type</label>
          <select className="input" value={form.type} onChange={(e) => set('type', e.target.value as any)}>
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
            <option value="socks5">SOCKS5</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Host</label>
          <input
            className="input font-mono text-xs"
            placeholder="proxy.example.com or type:host:port[:user[:pass]]"
            value={form.host}
            onChange={(e) => set('host', e.target.value)}
            onPaste={(e) => {
              e.preventDefault()
              const text = e.clipboardData?.getData('text/plain') || ''
              handleHostPaste(text)
            }}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Port</label>
          <input className="input" type="number" placeholder="8080" value={form.port} onChange={(e) => set('port', Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Username (optional)</label>
          <input className="input" placeholder="user" value={form.username} onChange={(e) => set('username', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Password (optional)</label>
          <div className="relative">
            <input
              className="input pr-9"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
        <button onClick={submit} disabled={loading || !form.host || !form.name} className="btn-primary text-sm flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Proxy
        </button>
      </div>
    </div>
  )
}

function EditProxyModal({
  proxy,
  onSave,
  onCancel,
}: {
  proxy: ProxyConfig
  onSave: (patch: UpdateProxyInput) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<UpdateProxyInput>({
    name: proxy.name,
    type: proxy.type,
    host: proxy.host,
    port: proxy.port,
    username: proxy.username ?? null,
    password: proxy.password ?? null,
    country: proxy.country ?? null,
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const set = (k: keyof UpdateProxyInput, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.host || !form.name) return
    setLoading(true)
    try {
      await onSave(form)
      onCancel()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-white mb-4">Edit Proxy</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Label</label>
            <input className="input" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Type</label>
            <select className="input" value={form.type ?? ''} onChange={(e) => set('type', e.target.value as any)}>
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks5">SOCKS5</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Host</label>
            <input className="input font-mono text-xs" value={form.host ?? ''} onChange={(e) => set('host', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Port</label>
            <input className="input" type="number" value={form.port ?? ''} onChange={(e) => set('port', Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Username</label>
            <input className="input" placeholder="(clear to remove)" value={form.username ?? ''} onChange={(e) => set('username', e.target.value || null)} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Password</label>
            <div className="relative">
              <input
                className="input pr-9"
                type={showPassword ? 'text' : 'password'}
                placeholder="(clear to remove)"
                value={form.password ?? ''}
                onChange={(e) => set('password', e.target.value || null)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-400 mb-1 block">Country (optional)</label>
            <input className="input" placeholder="VN, TH, ID, etc." value={form.country ?? ''} onChange={(e) => set('country', e.target.value || null)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
          <button onClick={submit} disabled={loading || !form.host || !form.name} className="btn-primary text-sm flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

interface PoolViewProps {
  proxies: ProxyConfig[]
  testing: Set<string>
  search: string
  showAdd: boolean
  setShowAdd: (v: boolean) => void
  createProxy: (input: CreateProxyInput) => Promise<void>
  updateProxy: (id: string, patch: UpdateProxyInput) => Promise<void>
  deleteProxy: (id: string) => Promise<void>
  deleteProxies: (ids: string[]) => Promise<void>
  testProxy: (id: string) => Promise<any>
  testProxies: (ids: string[]) => Promise<void>
}

function PoolView({
  proxies,
  testing,
  search,
  showAdd,
  setShowAdd,
  createProxy,
  updateProxy,
  deleteProxy,
  deleteProxies,
  testProxy,
  testProxies,
}: PoolViewProps) {
  const push = useToastStore((s) => s.push)
  const [editProxy, setEditProxy] = useState<ProxyConfig | null>(null)
  const [sortField, setSortField] = useState<SortField>('created')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [filterHealth, setFilterHealth] = useState<'all' | 'healthy' | 'unhealthy'>('all')
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Filtered and sorted list
  const filtered = useMemo(() => {
    let items = proxies.filter((p) =>
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.host.toLowerCase().includes(search.toLowerCase())) &&
      (filterHealth === 'all' || (filterHealth === 'healthy' ? (p as any).is_healthy : !(p as any).is_healthy))
    )

    items.sort((a, b) => {
      let aVal: any, bVal: any
      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case 'host':
          aVal = a.host.toLowerCase()
          bVal = b.host.toLowerCase()
          break
        case 'latency':
          aVal = (a as any).latency_ms ?? Infinity
          bVal = (b as any).latency_ms ?? Infinity
          break
        case 'health':
          aVal = (a as any).is_healthy ? 0 : 1
          bVal = (b as any).is_healthy ? 0 : 1
          break
        case 'created':
          aVal = new Date(a.created_at || 0).getTime()
          bVal = new Date(b.created_at || 0).getTime()
          break
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return items
  }, [proxies, search, filterHealth, sortField, sortOrder])

  const handleBulkImport = async () => {
    const lines = bulkText.split('\n')
    setBulkLoading(true)
    try {
      const result = await window.api.proxies.importBulk(lines)
      push(`Imported ${result.imported} proxies${result.failed > 0 ? ` · ${result.failed} failed` : ''}`, 'success')
      setBulkText('')
      setShowBulkImport(false)
    } finally {
      setBulkLoading(false)
    }
  }

  const stats = useMemo(() => {
    const healthy = filtered.filter((p) => (p as any).is_healthy).length
    const tested = filtered.filter((p) => (p as any).last_checked_at).length
    const avgLatency = filtered
      .filter((p) => (p as any).latency_ms)
      .reduce((sum, p) => sum + (p as any).latency_ms, 0) / (tested || 1)
    return { healthy, tested, avgLatency: Math.round(avgLatency) }
  }, [filtered])

  const handleTestSelected = async () => {
    if (selected.size === 0) return
    await testProxies(Array.from(selected))
    push(`Testing ${selected.size} proxies…`, 'info')
  }

  const handleDeleteSelected = async () => {
    if (selected.size === 0 || !confirm(`Delete ${selected.size} proxy/proxies?`)) return
    await deleteProxies(Array.from(selected))
    setSelected(new Set())
    push(`Deleted ${selected.size} proxies`, 'success')
  }

  const copyUrl = (proxy: ProxyConfig) => {
    const url = `${proxy.type}://${proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : ''}${proxy.host}:${proxy.port}`
    navigator.clipboard.writeText(url)
    push('Copied to clipboard', 'success')
  }

  return (
    <>
      {showAdd && <AddProxyForm onAdd={createProxy} onCancel={() => setShowAdd(false)} />}

      {/* Stats bar */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="card flex items-center justify-between">
            <span className="text-xs text-slate-400">Healthy</span>
            <span className="text-sm font-medium text-green-400">{stats.healthy} / {filtered.length}</span>
          </div>
          <div className="card flex items-center justify-between">
            <span className="text-xs text-slate-400">Tested</span>
            <span className="text-sm font-medium text-blue-400">{stats.tested} / {filtered.length}</span>
          </div>
          <div className="card flex items-center justify-between">
            <span className="text-xs text-slate-400">Avg Latency</span>
            <span className="text-sm font-medium text-purple-400">{stats.avgLatency}ms</span>
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={filterHealth}
          onChange={(e) => setFilterHealth(e.target.value as any)}
          className="input text-xs flex-1 min-w-32"
        >
          <option value="all">All proxies</option>
          <option value="healthy">Healthy only</option>
          <option value="unhealthy">Unhealthy only</option>
        </select>

        <button
          onClick={() => {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
          }}
          className="btn-secondary text-xs flex items-center gap-1.5 py-2"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {sortField} {sortOrder === 'asc' ? '↑' : '↓'}
        </button>

        <div className="flex-1" />

        {selected.size > 0 && (
          <>
            <span className="text-xs text-slate-400">{selected.size} selected</span>
            <button onClick={handleTestSelected} className="btn-secondary text-xs flex items-center gap-1.5 py-2">
              <Wifi className="w-3.5 h-3.5" />
              Test
            </button>
            <button onClick={handleDeleteSelected} className="btn-danger text-xs flex items-center gap-1.5 py-2">
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </>
        )}
      </div>

      {filtered.length === 0 && !showAdd ? (
        <div className="flex flex-col items-center justify-center h-60 text-center">
          <Globe className="w-12 h-12 text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No proxies found</p>
          <p className="text-slate-500 text-sm mt-1 mb-4">Add proxies to get started, or import from a list</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Proxy
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((proxy) => {
            const isTesting = testing.has(proxy.id)
            const isHealthy = (proxy as any).is_healthy
            const latency = (proxy as any).latency_ms
            const isSelected = selected.has(proxy.id)

            return (
              <div
                key={proxy.id}
                className={`card flex items-center gap-3 hover:border-slate-600 transition-colors cursor-pointer ${
                  isSelected ? 'border-ghost-500 bg-ghost-900/10' : ''
                }`}
                onClick={() => {
                  const newSet = new Set(selected)
                  if (newSet.has(proxy.id)) newSet.delete(proxy.id)
                  else newSet.add(proxy.id)
                  setSelected(newSet)
                }}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {
                    const newSet = new Set(selected)
                    if (newSet.has(proxy.id)) newSet.delete(proxy.id)
                    else newSet.add(proxy.id)
                    setSelected(newSet)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded border-slate-600 accent-ghost-500"
                />

                {/* Status indicator */}
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    isHealthy ? 'bg-green-900/40' : 'bg-slate-700'
                  }`}
                >
                  {isHealthy
                    ? <Wifi className="w-3.5 h-3.5 text-green-400" />
                    : <WifiOff className="w-3.5 h-3.5 text-slate-500" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{proxy.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 uppercase font-mono shrink-0">
                      {proxy.type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 font-mono">
                    {proxy.host}:{proxy.port}
                    {proxy.username && ' · auth'}
                    {latency && ` · ${latency}ms`}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => copyUrl(proxy)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors"
                    title="Copy proxy URL"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditProxy(proxy)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors"
                    title="Edit proxy"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => testProxy(proxy.id)}
                    disabled={isTesting}
                    className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-2"
                    title="Test connection"
                  >
                    {isTesting
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Wifi className="w-3.5 h-3.5" />
                    }
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete proxy "${proxy.name}"?`)) deleteProxy(proxy.id) }}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-red-600/20 hover:text-red-400 transition-colors"
                    title="Delete proxy"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit modal */}
      {editProxy && (
        <EditProxyModal
          proxy={editProxy}
          onSave={(patch) => updateProxy(editProxy.id, patch)}
          onCancel={() => setEditProxy(null)}
        />
      )}

      {/* Bulk import modal */}
      {showBulkImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-white mb-2">Import Proxy List</h2>
            <p className="text-xs text-slate-400 mb-3">
              One proxy per line: <code className="text-slate-300">type:host:port[:user[:pass]]</code>
              <br />Example: <code className="text-slate-300">socks5:1.2.3.4:1080:user:pass</code>
            </p>
            <textarea
              className="input resize-none h-48 font-mono text-xs mb-3"
              placeholder={"http:1.2.3.4:8080\nsocks5:5.6.7.8:1080:user:pass"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowBulkImport(false); setBulkText('') }} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleBulkImport} disabled={bulkLoading || !bulkText.trim()} className="btn-primary text-sm flex items-center gap-2">
                {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {bulkLoading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function ProxyManager() {
  const { proxies, testing, fetchProxies, createProxy, updateProxy, deleteProxy, deleteProxies, testProxy, testProxies } = useProxyStore()
  const [tab, setTab] = useState<ProxyTab>('pool')
  const [showAdd, setShowAdd] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchProxies() }, [])

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Proxy Manager"
        subtitle={`${proxies.length} proxies configured`}
        search={tab === 'pool' ? search : undefined}
        onSearchChange={tab === 'pool' ? setSearch : undefined}
        actions={
          tab === 'pool' ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowBulkImport(true)} className="btn-ghost flex items-center gap-2 text-sm">
                <Upload className="w-4 h-4" />
                Import List
              </button>
              <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" />
                Add Proxy
              </button>
            </div>
          ) : null
        }
      />

      {/* Tab strip */}
      <div className="border-b border-slate-800 px-6">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab('pool')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tab === 'pool'
                ? 'text-white border-ghost-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            Proxy Pool
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{proxies.length}</span>
          </button>
          <button
            onClick={() => setTab('providers')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tab === 'providers'
                ? 'text-white border-ghost-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Cloud className="w-4 h-4" />
            Provider Accounts
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'providers' ? (
          <ProviderPanel />
        ) : (
          <PoolView
            proxies={proxies}
            testing={testing}
            search={search}
            showAdd={showAdd}
            setShowAdd={setShowAdd}
            createProxy={createProxy}
            updateProxy={updateProxy}
            deleteProxy={deleteProxy}
            deleteProxies={deleteProxies}
            testProxy={testProxy}
            testProxies={testProxies}
          />
        )}
      </div>

      {/* Bulk import modal moved to PoolView */}
      {showBulkImport && tab === 'pool' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-white mb-2">Import Proxy List</h2>
            <p className="text-xs text-slate-400 mb-3">
              One proxy per line: <code className="text-slate-300">type:host:port[:user[:pass]]</code>
              <br />Example: <code className="text-slate-300">socks5:1.2.3.4:1080:user:pass</code>
            </p>
            <textarea
              className="input resize-none h-48 font-mono text-xs mb-3"
              placeholder={"http:1.2.3.4:8080\nsocks5:5.6.7.8:1080:user:pass"}
              onChange={(e) => {}}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowBulkImport(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
