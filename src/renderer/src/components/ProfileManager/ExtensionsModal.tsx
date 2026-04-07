import React, { useEffect, useState } from 'react'
import { X, Plus, Trash2, FolderOpen, ToggleLeft, ToggleRight, Puzzle, AlertCircle } from 'lucide-react'
import type { Profile, ProfileExtension } from '../../types'

interface Props {
  profile: Profile
  onClose: () => void
}

export function ExtensionsModal({ profile, onClose }: Props) {
  const [extensions, setExtensions] = useState<ProfileExtension[]>([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const fetchExtensions = async () => {
    setLoading(true)
    try {
      const list = await window.api.extensions.list(profile.id)
      setExtensions(list)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load extensions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchExtensions() }, [profile.id])

  const handleAdd = async () => {
    setError(null)
    try {
      const picked = await window.api.extensions.pickFolder()
      if (!picked) return
      await window.api.extensions.add(profile.id, picked.name, picked.path)
      await fetchExtensions()
    } catch (e: any) {
      setError(e.message ?? 'Failed to add extension')
    }
  }

  const handleToggle = async (ext: ProfileExtension) => {
    try {
      await window.api.extensions.setEnabled(ext.id, !ext.enabled)
      await fetchExtensions()
    } catch (e: any) {
      setError(e.message ?? 'Failed to toggle extension')
    }
  }

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this extension from the profile?')) return
    try {
      await window.api.extensions.remove(id)
      await fetchExtensions()
    } catch (e: any) {
      setError(e.message ?? 'Failed to remove extension')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Puzzle className="w-5 h-5 text-ghost-400" />
            <h2 className="text-base font-semibold text-white">Extensions — {profile.name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}>&times;</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-xs text-slate-500 mb-3">
            Load unpacked Chrome extensions for this profile. Extensions take effect on the next launch.
            {' '}Make sure the folder you select contains a <code>manifest.json</code>.
          </p>

          {loading ? (
            <div className="text-center text-slate-500 text-sm py-6">Loading…</div>
          ) : extensions.length === 0 ? (
            <div className="text-center py-8">
              <Puzzle className="w-10 h-10 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-400 text-sm font-medium">No extensions installed</p>
              <p className="text-slate-500 text-xs mt-1">Click "Add extension" to load an unpacked folder.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {extensions.map((ext) => (
                <div key={ext.id} className="flex items-start gap-3 p-3 bg-slate-900/40 border border-slate-700/60 rounded-xl">
                  <FolderOpen className="w-4 h-4 text-ghost-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{ext.name}</div>
                    <div className="text-[11px] text-slate-500 truncate font-mono" title={ext.path}>{ext.path}</div>
                  </div>
                  <button
                    onClick={() => handleToggle(ext)}
                    title={ext.enabled ? 'Disable' : 'Enable'}
                    className={`p-1.5 rounded-lg transition-colors ${ext.enabled ? 'text-green-400 hover:bg-green-600/10' : 'text-slate-500 hover:bg-slate-700'}`}
                  >
                    {ext.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleRemove(ext.id)}
                    title="Remove"
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-600/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-700 hover:border-ghost-500 text-slate-500 hover:text-ghost-400 rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add extension folder…
          </button>
        </div>
      </div>
    </div>
  )
}
