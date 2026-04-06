import React, { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useProfileStore } from '../../stores/profileStore'
import { useProxyStore } from '../../stores/proxyStore'

const PRESETS = [
  { key: 'win10-chrome120',       label: 'Windows 10 · Chrome 120' },
  { key: 'win11-chrome121',       label: 'Windows 11 · Chrome 121' },
  { key: 'mac-ventura-chrome120', label: 'macOS Ventura · Chrome 120' },
  { key: 'mac-sonoma-chrome121',  label: 'macOS Sonoma · Chrome 121' },
  { key: 'linux-ubuntu-chrome120',label: 'Ubuntu 22.04 · Chrome 120' }
]

interface Props {
  onClose: () => void
}

export function CreateProfileModal({ onClose }: Props) {
  const { proxies } = useProxyStore()
  const { createProfile } = useProfileStore()

  const [name, setName]     = useState('')
  const [preset, setPreset] = useState(PRESETS[0].key)
  const [proxyId, setProxyId] = useState('')
  const [notes, setNotes]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const submit = async () => {
    if (!name.trim()) { setError('Profile name is required'); return }
    setLoading(true)
    setError('')
    try {
      await createProfile({ name: name.trim(), preset, proxy_id: proxyId || undefined, notes })
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">New Profile</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Profile Name *</label>
            <input
              className="input"
              placeholder="e.g. Shop Account #1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Preset */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Fingerprint Preset</label>
            <select
              className="input"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Proxy */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Proxy (optional)</label>
            <select
              className="input"
              value={proxyId}
              onChange={(e) => setProxyId(e.target.value)}
            >
              <option value="">No proxy</option>
              {proxies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.host}:{p.port}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes (optional)</label>
            <textarea
              className="input resize-none h-20"
              placeholder="Account credentials, purpose..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={submit} disabled={loading} className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {loading ? 'Creating...' : 'Create Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
