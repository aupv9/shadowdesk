import React, { useEffect, useState } from 'react'
import { History, RotateCcw, Trash2, Save, X, Clock } from 'lucide-react'
import type { Profile, ProfileVersion } from '../../types'

interface Props {
  profile: Profile
  onClose: () => void
  onRestored: () => void
}

export function ProfileHistory({ profile, onClose, onRestored }: Props) {
  const [versions,  setVersions]  = useState<ProfileVersion[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [label,     setLabel]     = useState('')
  const [error,     setError]     = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const list = await window.api.profiles.history(profile.id)
      setVersions(list)
    } catch {
      setError('Failed to load version history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [profile.id])

  const handleSave = async () => {
    if (!label.trim()) return
    setSaving(true)
    try {
      await window.api.profiles.saveVersion(profile.id, label.trim())
      setLabel('')
      await load()
    } catch {
      setError('Failed to save snapshot')
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = async (version: ProfileVersion) => {
    if (!confirm(`Restore fingerprint from "${version.label}"? The current fingerprint will be saved automatically.`)) return
    setRestoring(version.id)
    try {
      await window.api.profiles.restoreVersion(profile.id, version.id)
      onRestored()
      await load()
    } catch {
      setError('Failed to restore version')
    } finally {
      setRestoring(null)
    }
  }

  const handleDelete = async (versionId: string) => {
    try {
      await window.api.profiles.deleteVersion(versionId)
      setVersions((v) => v.filter((x) => x.id !== versionId))
    } catch {
      setError('Failed to delete version')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-ghost-400" />
            <div>
              <h2 className="text-sm font-semibold text-white">Version History</h2>
              <p className="text-xs text-slate-400">{profile.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Save snapshot */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Snapshot label (e.g. 'Working config')"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-ghost-500"
            />
            <button
              onClick={handleSave}
              disabled={!label.trim() || saving}
              className="flex items-center gap-1.5 px-3 py-2 bg-ghost-600/20 hover:bg-ghost-600/30 text-ghost-400
                         text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {error && (
            <div className="text-xs text-red-400 bg-red-600/10 border border-red-600/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-6 h-6 border-2 border-ghost-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No version history yet</p>
              <p className="text-xs text-slate-500 mt-1">Snapshots are saved automatically on reroll</p>
            </div>
          ) : (
            versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 group"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{version.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(version.savedAt).toLocaleString()} · {version.fingerprint.preset}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleRestore(version)}
                    disabled={restoring === version.id}
                    title="Restore this fingerprint"
                    className="p-1.5 rounded-lg text-ghost-400 hover:bg-ghost-600/20 transition-colors disabled:opacity-40"
                  >
                    {restoring === version.id
                      ? <div className="w-3.5 h-3.5 border-2 border-ghost-400 border-t-transparent rounded-full animate-spin" />
                      : <RotateCcw className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDelete(version.id)}
                    title="Delete this version"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-600/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-slate-800 text-center text-xs text-slate-500">
          Last 20 versions kept automatically
        </div>
      </div>
    </div>
  )
}
