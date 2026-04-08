import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Wifi, WifiOff, Loader2, Globe, Upload, Cloud, ListFilter } from 'lucide-react'
import { useProxyStore } from '../../stores/proxyStore'
import { Header } from '../Layout/Header'
import type { CreateProxyInput, ProxyConfig } from '../../types'
import { ProviderPanel } from './ProviderPanel'

type ProxyTab = 'pool' | 'providers'

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
  const set = (k: keyof CreateProxyInput, v: any) => setForm((f) => ({ ...f, [k]: v }))

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
            <option value="socks5">SOCKS5</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Host</label>
          <input className="input" placeholder="proxy.example.com" value={form.host} onChange={(e) => set('host', e.target.value)} />
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
          <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={(e) => set('password', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
        <button onClick={submit} disabled={loading} className="btn-primary text-sm flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Proxy
        </button>
      </div>
    </div>
  )
}

export function ProxyManager() {
  const { proxies, testing, fetchProxies, createProxy, deleteProxy, testProxy } = useProxyStore()
  const [tab,            setTab]            = useState<ProxyTab>('pool')
  const [showAdd,        setShowAdd]        = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkText,       setBulkText]       = useState('')
  const [bulkResult,     setBulkResult]     = useState<{ imported: number; failed: number } | null>(null)
  const [bulkLoading,    setBulkLoading]    = useState(false)
  const [search,         setSearch]         = useState('')

  useEffect(() => { fetchProxies() }, [])

  const handleBulkImport = async () => {
    const lines = bulkText.split('\n')
    setBulkLoading(true)
    try {
      const result = await window.api.proxies.importBulk(lines)
      setBulkResult(result)
      await fetchProxies()
      setTimeout(() => { setShowBulkImport(false); setBulkText(''); setBulkResult(null) }, 2000)
    } finally {
      setBulkLoading(false)
    }
  }

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

      {/* Phase 20 — Proxy Provider Marketplace tab strip */}
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
            deleteProxy={deleteProxy}
            testProxy={testProxy}
          />
        )}
      </div>

      {/* Bulk import modal */}
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
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            {bulkResult && (
              <p className="text-sm text-green-400 mb-3">
                ✓ {bulkResult.imported} imported{bulkResult.failed > 0 ? ` · ${bulkResult.failed} failed` : ''}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowBulkImport(false); setBulkText(''); setBulkResult(null) }} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleBulkImport} disabled={bulkLoading || !bulkText.trim()} className="btn-primary text-sm flex items-center gap-2">
                {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {bulkLoading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
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
  deleteProxy: (id: string) => Promise<void>
  testProxy: (id: string) => Promise<{ latency_ms: number; healthy: boolean }>
}

function PoolView({ proxies, testing, search, showAdd, setShowAdd, createProxy, deleteProxy, testProxy }: PoolViewProps) {
  const filtered = proxies.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.host.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      {showAdd && (
        <AddProxyForm onAdd={createProxy} onCancel={() => setShowAdd(false)} />
      )}

      {filtered.length === 0 && !showAdd ? (
        <div className="flex flex-col items-center justify-center h-60 text-center">
          <Globe className="w-12 h-12 text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No proxies yet</p>
          <p className="text-slate-500 text-sm mt-1 mb-4">Add HTTP or SOCKS5 proxies for your browser profiles</p>
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

            return (
              <div key={proxy.id} className="card flex items-center gap-4 hover:border-slate-600 transition-colors">
                {/* Status indicator */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isHealthy ? 'bg-green-900/40' : 'bg-slate-700'
                }`}>
                  {isHealthy
                    ? <Wifi className="w-4 h-4 text-green-400" />
                    : <WifiOff className="w-4 h-4 text-slate-500" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{proxy.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 uppercase font-mono">
                      {proxy.type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 font-mono">
                    {proxy.host}:{proxy.port}
                    {proxy.username && ` · auth`}
                    {latency && ` · ${latency}ms`}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => testProxy(proxy.id)}
                    disabled={isTesting}
                    className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
                  >
                    {isTesting
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Wifi className="w-3.5 h-3.5" />
                    }
                    {isTesting ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete proxy "${proxy.name}"?`)) deleteProxy(proxy.id) }}
                    className="p-2 rounded-lg text-slate-500 hover:bg-red-600/20 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
