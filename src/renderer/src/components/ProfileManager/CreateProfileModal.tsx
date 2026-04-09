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

  const hasNameError = !name.trim() && name !== ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl shadow-black/50 animate-in scale-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">New Profile</h2>
            <p className="text-xs text-slate-400 mt-0.5">Create a new anti-detect profile</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg hover:bg-slate-700/50" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          {/* Name */}
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${hasNameError ? 'text-red-400' : 'text-slate-300'}`}>
              Profile Name *
            </label>
            <input
              className={`input ${hasNameError ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30' : ''}`}
              placeholder="e.g. Shop Account #1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              aria-invalid={hasNameError}
            />
            {hasNameError && <p className="text-xs text-red-400 mt-1">Name is required</p>}
          </div>

          {/* Preset */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Fingerprint Preset</label>
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
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Proxy (optional)</label>
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
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Notes (optional)</label>
            <textarea
              className="input resize-none h-20"
              placeholder="Account credentials, purpose..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="text-red-400 shrink-0 mt-0.5">•</div>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
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
