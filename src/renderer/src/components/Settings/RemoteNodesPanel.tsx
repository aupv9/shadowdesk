/**
 * Phase 14.A — Remote Browser Nodes UI
 *
 * Lists configured remote Chromium nodes, lets the user add/remove/test them,
 * and shows live health (status, latency, capacity utilization).
 */

import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Activity, Server, Loader2 } from 'lucide-react'
import { useNodeStore } from '../../stores/nodeStore'

export function RemoteNodesPanel() {
  const { nodes, loading, fetch, add, remove, test } = useNodeStore()
  const [showAdd, setShowAdd] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', url: '', authToken: '', region: '', capacity: 5 })
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { fetch() }, [fetch])

  const handleAdd = async () => {
    setErr(null)
    try {
      await add({
        name: form.name,
        url: form.url,
        authToken: form.authToken || undefined,
        region: form.region || undefined,
        capacity: Number(form.capacity) || 5
      })
      setShowAdd(false)
      setForm({ name: '', url: '', authToken: '', region: '', capacity: 5 })
    } catch (e: any) {
      setErr(e.message)
    }
  }

  const handleTest = async (id: string) => {
    setBusy(id)
    try { await test(id) } finally { setBusy(null) }
  }

  const statusColor = (s: string) =>
    s === 'online'  ? 'text-emerald-400' :
    s === 'offline' ? 'text-slate-500' :
    s === 'error'   ? 'text-red-400' : 'text-amber-400'

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-400" />
          Remote Browser Nodes
        </h3>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="btn-primary text-xs flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add Node
        </button>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Configure remote Chromium nodes to distribute browser sessions across machines.
        Each node must expose a <code>/health</code> endpoint.
      </p>

      {showAdd && (
        <div className="mb-4 p-3 bg-slate-800/60 rounded-lg space-y-2">
          <input
            className="input-field text-xs"
            placeholder="Name (e.g. node-sgp-1)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="input-field text-xs"
            placeholder="URL (e.g. https://node.example.com:9222)"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input-field text-xs"
              placeholder="Region (optional)"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            />
            <input
              type="number"
              className="input-field text-xs"
              placeholder="Capacity"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            />
          </div>
          <input
            className="input-field text-xs"
            placeholder="Auth token (optional)"
            value={form.authToken}
            onChange={(e) => setForm({ ...form, authToken: e.target.value })}
          />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn-primary text-xs">Save</button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary text-xs">Cancel</button>
          </div>
        </div>
      )}

      {loading && nodes.length === 0 ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : nodes.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4">No remote nodes configured.</p>
      ) : (
        <div className="space-y-2">
          {nodes.map((n) => {
            const util = n.capacity > 0 ? Math.round((n.activeProfiles / n.capacity) * 100) : 0
            return (
              <div key={n.id} className="p-3 bg-slate-800/60 rounded-lg flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  n.status === 'online' ? 'bg-emerald-400' :
                  n.status === 'error'  ? 'bg-red-400' :
                  n.status === 'offline'? 'bg-slate-500' : 'bg-amber-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{n.name}</p>
                  <p className="text-xs text-slate-500 truncate">{n.url}{n.region ? ` · ${n.region}` : ''}</p>
                </div>
                <div className="text-xs text-right">
                  <p className={statusColor(n.status)}>{n.status}{n.latencyMs != null ? ` · ${n.latencyMs}ms` : ''}</p>
                  <p className="text-slate-500">{n.activeProfiles}/{n.capacity} ({util}%)</p>
                </div>
                <button
                  onClick={() => handleTest(n.id)}
                  disabled={busy === n.id}
                  className="text-slate-400 hover:text-indigo-300 p-1.5 rounded"
                  title="Ping node"
                >
                  {busy === n.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Activity className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => remove(n.id)}
                  className="text-slate-400 hover:text-red-400 p-1.5 rounded"
                  title="Remove node"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
