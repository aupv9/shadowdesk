import React, { useEffect, useState } from 'react'
import { X, RefreshCw, Database, HardDrive } from 'lucide-react'

/**
 * Phase 12.C.2 — read-only inspector for per-profile storage.
 *
 * Requires the profile to be currently running so we can speak CDP through
 * the live page. The same drawer is reused for both DOMStorage (local +
 * session) and IndexedDB.
 */

interface Props {
  profileId: string
  profileName: string
  onClose: () => void
}

type Tab = 'localStorage' | 'sessionStorage' | 'indexedDb'

interface IdbDb {
  name: string
  version: number
  stores: string[]
}

interface IdbEntry {
  key: any
  primaryKey: any
  value: any
}

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

export function StorageInspectorModal({ profileId, profileName, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('localStorage')
  const [origins, setOrigins] = useState<string[]>([])
  const [origin, setOrigin] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [domEntries, setDomEntries] = useState<{ key: string; value: string }[]>([])

  const [dbs, setDbs] = useState<IdbDb[]>([])
  const [selectedDb, setSelectedDb] = useState<string>('')
  const [selectedStore, setSelectedStore] = useState<string>('')
  const [idbEntries, setIdbEntries] = useState<IdbEntry[]>([])
  const [idbHasMore, setIdbHasMore] = useState(false)

  // ── Load origins on mount ───────────────────────────────────────────────
  useEffect(() => {
    void loadOrigins()
  }, [])

  // ── When tab / origin changes, refresh ───────────────────────────────────
  useEffect(() => {
    if (!origin) return
    if (tab === 'indexedDb') {
      void loadIndexedDbList()
    } else {
      void loadDomStorage()
    }
  }, [tab, origin])

  // ── When db selection changes, reset store list ──────────────────────────
  useEffect(() => {
    setSelectedStore('')
    setIdbEntries([])
    setIdbHasMore(false)
  }, [selectedDb])

  // ── Auto-load entries when a store is picked ─────────────────────────────
  useEffect(() => {
    if (selectedDb && selectedStore) void loadIdbEntries()
  }, [selectedDb, selectedStore])

  const loadOrigins = async () => {
    setLoading(true)
    setError('')
    try {
      const list = await window.api.storage.listOrigins(profileId)
      setOrigins(list)
      if (list.length > 0 && !origin) setOrigin(list[0])
    } catch (e: any) {
      setError(e.message ?? 'Failed to list origins')
    } finally {
      setLoading(false)
    }
  }

  const loadDomStorage = async () => {
    setLoading(true)
    setError('')
    try {
      const isLocal = tab === 'localStorage'
      const entries = await window.api.storage.getDOMStorage(profileId, origin, isLocal)
      setDomEntries(entries)
    } catch (e: any) {
      setError(e.message ?? 'Failed to read storage')
      setDomEntries([])
    } finally {
      setLoading(false)
    }
  }

  const loadIndexedDbList = async () => {
    setLoading(true)
    setError('')
    setSelectedDb('')
    setSelectedStore('')
    setIdbEntries([])
    try {
      const list = await window.api.storage.listIndexedDb(profileId, origin)
      setDbs(list)
      if (list.length > 0) setSelectedDb(list[0].name)
    } catch (e: any) {
      setError(e.message ?? 'Failed to list IndexedDB')
      setDbs([])
    } finally {
      setLoading(false)
    }
  }

  const loadIdbEntries = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await window.api.storage.getIndexedDbEntries(
        profileId,
        origin,
        selectedDb,
        selectedStore,
        100
      )
      setIdbEntries(result.entries)
      setIdbHasMore(result.hasMore)
    } catch (e: any) {
      setError(e.message ?? 'Failed to read IndexedDB store')
      setIdbEntries([])
    } finally {
      setLoading(false)
    }
  }

  const currentDb = dbs.find((d) => d.name === selectedDb)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h2 className="text-base font-semibold text-white">Storage inspector</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[28rem]" title={profileName}>
              {profileName}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 border-b border-slate-700">
          {(
            [
              ['localStorage', 'localStorage', <HardDrive className="w-3.5 h-3.5" key="ls" />],
              ['sessionStorage', 'sessionStorage', <HardDrive className="w-3.5 h-3.5" key="ss" />],
              ['indexedDb', 'IndexedDB', <Database className="w-3.5 h-3.5" key="db" />]
            ] as const
          ).map(([t, label, icon]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
                tab === t
                  ? 'text-white border-ghost-500'
                  : 'text-slate-500 hover:text-slate-300 border-transparent'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Origin selector */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-700/60">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">
            Origin
          </label>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="input flex-1 text-sm"
            disabled={origins.length === 0}
          >
            {origins.length === 0 && <option value="">No active origins</option>}
            {origins.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <button
            onClick={loadOrigins}
            disabled={loading}
            className="btn-ghost p-2 rounded-lg"
            title="Re-scan open tabs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-red-600/10 border border-red-600/30 text-sm text-red-400">
              {error}
            </div>
          )}

          {!origin && !error && (
            <div className="text-center text-sm text-slate-500 py-12">
              Launch the profile and visit a website, then re-scan to see its storage.
            </div>
          )}

          {/* DOM storage table */}
          {origin && (tab === 'localStorage' || tab === 'sessionStorage') && (
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-900/60 text-slate-500 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-1/3">Key</th>
                    <th className="text-left px-3 py-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {domEntries.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-6 text-center text-slate-500">
                        {loading ? 'Loading…' : `No ${tab} entries`}
                      </td>
                    </tr>
                  )}
                  {domEntries.map((e, i) => (
                    <tr
                      key={`${e.key}-${i}`}
                      className="border-t border-slate-700/60 align-top"
                    >
                      <td className="px-3 py-1.5 text-slate-200 font-mono break-all">{e.key}</td>
                      <td className="px-3 py-1.5 text-slate-400 font-mono break-all whitespace-pre-wrap">
                        {e.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* IndexedDB browser */}
          {origin && tab === 'indexedDb' && (
            <div>
              {dbs.length === 0 ? (
                <div className="text-center text-sm text-slate-500 py-8">
                  {loading ? 'Loading…' : 'No IndexedDB databases for this origin'}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500">
                        Database
                      </label>
                      <select
                        value={selectedDb}
                        onChange={(e) => setSelectedDb(e.target.value)}
                        className="input w-full text-sm"
                      >
                        {dbs.map((d) => (
                          <option key={d.name} value={d.name}>
                            {d.name} (v{d.version})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500">
                        Object store
                      </label>
                      <select
                        value={selectedStore}
                        onChange={(e) => setSelectedStore(e.target.value)}
                        className="input w-full text-sm"
                        disabled={!currentDb || currentDb.stores.length === 0}
                      >
                        <option value="">Select a store…</option>
                        {currentDb?.stores.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedStore && (
                    <div className="border border-slate-700 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-900/60 text-slate-500 text-[10px] uppercase tracking-wider">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium w-32">Key</th>
                            <th className="text-left px-3 py-2 font-medium">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {idbEntries.length === 0 && (
                            <tr>
                              <td colSpan={2} className="px-3 py-6 text-center text-slate-500">
                                {loading ? 'Loading…' : 'No entries'}
                              </td>
                            </tr>
                          )}
                          {idbEntries.map((e, i) => (
                            <tr key={i} className="border-t border-slate-700/60 align-top">
                              <td className="px-3 py-1.5 text-slate-200 font-mono break-all">
                                {formatValue(e.primaryKey ?? e.key)}
                              </td>
                              <td className="px-3 py-1.5 text-slate-400 font-mono break-all whitespace-pre-wrap">
                                {formatValue(e.value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {idbHasMore && (
                        <div className="px-3 py-2 text-[10px] text-slate-500 bg-slate-900/40 border-t border-slate-700">
                          Showing first 100 entries — store has more.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">
            Read-only · Requires the profile to be running
          </span>
          <button onClick={onClose} className="btn-secondary text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
