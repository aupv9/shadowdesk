import React, { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useProfileStore } from '../../stores/profileStore'
import { useProxyStore } from '../../stores/proxyStore'
import { useGroupStore } from '../../stores/groupStore'
import type { Profile } from '../../types'

interface Props {
  profile: Profile
  onClose: () => void
}

export function EditProfileModal({ profile, onClose }: Props) {
  const { proxies }       = useProxyStore()
  const { groups }        = useGroupStore()
  const { updateProfile } = useProfileStore()

  const [name,         setName]         = useState(profile.name)
  const [proxyId,      setProxyId]      = useState(profile.proxy_id ?? '')
  const [groupId,      setGroupId]      = useState(profile.group_id ?? '')
  const [notes,        setNotes]        = useState(profile.notes ?? '')
  const [rotationMode, setRotationMode] = useState<string>(profile.rotation_mode ?? 'none')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  const submit = async () => {
    if (!name.trim()) { setError('Profile name is required'); return }
    setLoading(true)
    setError('')
    try {
      await updateProfile(profile.id, {
        name:          name.trim(),
        proxy_id:      proxyId  || null,
        group_id:      groupId  || null,
        notes,
        rotation_mode: rotationMode
      })
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
          <h2 className="text-base font-semibold text-white">Edit Profile</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Profile Name *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Proxy</label>
            <select className="input" value={proxyId} onChange={(e) => setProxyId(e.target.value)}>
              <option value="">No proxy (direct)</option>
              {proxies.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} — {p.host}:{p.port}</option>
              ))}
            </select>
          </div>

          {groups.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Group</label>
              <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Proxy Rotation</label>
            <select className="input" value={rotationMode} onChange={(e) => setRotationMode(e.target.value)}>
              <option value="none">None (use fixed proxy above)</option>
              <option value="random">Random — pick healthy proxy on each launch</option>
              <option value="round-robin">Round-Robin — cycle through healthy proxies</option>
            </select>
            {rotationMode !== 'none' && (
              <p className="text-xs text-slate-500 mt-1">Fixed proxy above is ignored when rotation is enabled</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes</label>
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
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
