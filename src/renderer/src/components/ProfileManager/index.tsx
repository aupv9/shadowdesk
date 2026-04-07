import React, { useEffect, useState } from 'react'
import { Plus, RefreshCw, X, FolderPlus, CheckSquare, Trash2, ShieldAlert } from 'lucide-react'
import { useProfileStore } from '../../stores/profileStore'
import { useProxyStore } from '../../stores/proxyStore'
import { useGroupStore } from '../../stores/groupStore'
import { ProfileCard } from './ProfileCard'
import { CreateProfileModal } from './CreateProfileModal'
import { EditProfileModal } from './EditProfileModal'
import { CookieModal } from './CookieModal'
import { StorageInspectorModal } from './StorageInspectorModal'
import { ProfileHistory } from './ProfileHistory'
import { ExtensionsModal } from './ExtensionsModal'
import { WarmUpModal } from './WarmUpModal'
import { CollisionsDrawer } from './CollisionsDrawer'
import { Header } from '../Layout/Header'
import type { Profile } from '../../types'

const GROUP_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']

export function ProfileManager() {
  const {
    profiles, activeSessions, loading,
    fetchProfiles, fetchActiveSessions,
    launchProfile, closeProfile, deleteProfile, cloneProfile,
    exportProfile, importProfile
  } = useProfileStore()
  const { fetchProxies } = useProxyStore()
  const { groups, fetchGroups, createGroup, deleteGroup } = useGroupStore()

  const [showCreate,     setShowCreate]     = useState(false)
  const [editProfile,    setEditProfile]    = useState<Profile | null>(null)
  const [cookieModal,    setCookieModal]    = useState<{ profile: Profile; mode: 'browse' | 'import' | 'export' } | null>(null)
  const [storageProfile, setStorageProfile] = useState<Profile | null>(null)
  const [historyProfile, setHistoryProfile] = useState<Profile | null>(null)
  const [extensionsProfile, setExtensionsProfile] = useState<Profile | null>(null)
  const [warmUpProfile,     setWarmUpProfile]     = useState<Profile | null>(null)
  const [search,         setSearch]         = useState('')
  const [activeGroup,    setActiveGroup]    = useState<string | null>(null) // null = All
  const [launching,      setLaunching]      = useState<string | null>(null)
  const [error,          setError]          = useState<string | null>(null)
  const [selected,       setSelected]       = useState<Set<string>>(new Set())
  const [selectionMode,  setSelectionMode]  = useState(false)
  const [showCollisions, setShowCollisions] = useState(false)
  const [highlightId,    setHighlightId]    = useState<string | null>(null)

  // Group creation inline state
  const [showNewGroup,  setShowNewGroup]  = useState(false)
  const [newGroupName,  setNewGroupName]  = useState('')
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0])

  useEffect(() => {
    fetchProfiles()
    fetchActiveSessions()
    fetchProxies()
    fetchGroups()

    const interval = setInterval(fetchActiveSessions, 3000)
    return () => clearInterval(interval)
  }, [])

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      (p.notes ?? '').toLowerCase().includes(q) ||
      p.fingerprint.os.platform.toLowerCase().includes(q) ||
      (p.proxy_label ?? '').toLowerCase().includes(q)
    const matchGroup  = activeGroup === null || p.group_id === activeGroup
    return matchSearch && matchGroup
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); setShowCreate(true) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); document.querySelector<HTMLInputElement>('.header-search')?.focus() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') { e.preventDefault(); fetchProfiles(); fetchActiveSessions() }
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !showCreate && !editProfile && !cookieModal) {
        const focusedTag = document.activeElement?.tagName.toLowerCase()
        if (focusedTag === 'input' || focusedTag === 'textarea') return
        if (filtered.length > 0 && !activeSessions.includes(filtered[0].id)) {
          e.preventDefault()
          handleLaunch(filtered[0].id)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filtered, activeSessions, showCreate, editProfile, cookieModal])

  const handleLaunch = async (id: string) => {
    setLaunching(id)
    setError(null)
    try {
      await launchProfile(id)
    } catch (e: any) {
      setError(e.message ?? 'Failed to launch profile')
    } finally {
      setLaunching(null)
    }
  }

  const handleClone = async (id: string) => {
    try {
      await cloneProfile(id)
    } catch (e: any) {
      setError(e.message ?? 'Failed to clone profile')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this profile? This cannot be undone.')) return
    await deleteProfile(id)
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    await createGroup({ name: newGroupName.trim(), color: newGroupColor })
    setNewGroupName('')
    setShowNewGroup(false)
  }

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`Delete group "${name}"? Profiles in this group will become ungrouped.`)) return
    if (activeGroup === id) setActiveGroup(null)
    await deleteGroup(id)
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} profile(s)? This cannot be undone.`)) return
    for (const id of selected) {
      await deleteProfile(id)
    }
    setSelected(new Set())
    setSelectionMode(false)
  }

  const handleBulkClone = async () => {
    for (const id of selected) {
      await cloneProfile(id)
    }
    setSelected(new Set())
    setSelectionMode(false)
  }

  const handleExportBundle = async (id: string) => {
    try {
      const buffer = await exportProfile(id)
      const profile = profiles.find((p) => p.id === id)
      // The IPC bridge returns a Node Buffer; copy it into a fresh Uint8Array
      // backed by a real ArrayBuffer so it's a valid BlobPart in the renderer.
      const bytes = new Uint8Array(buffer)
      const blob = new Blob([bytes], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${profile?.name ?? id}.ghost.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e.message ?? 'Export failed')
    }
  }

  const handleApplyDrift = async (profile: Profile) => {
    if (!confirm(`Apply fingerprint drift to "${profile.name}"? This bumps the Chrome version and rotates noise seeds.`)) return
    try {
      await window.api.drift.apply(profile.id)
      await fetchProfiles()
    } catch (e: any) {
      setError(e.message ?? 'Failed to apply drift')
    }
  }

  const handlePickCollisionProfile = (profileId: string) => {
    setShowCollisions(false)
    setHighlightId(profileId)
    // Defer scroll until the drawer unmount + DOM updates settle
    setTimeout(() => {
      const el = document.getElementById(`profile-card-${profileId}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    // Auto-clear highlight after a few seconds
    setTimeout(() => setHighlightId(null), 3000)
  }

  const handleImportBundle = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const arrayBuffer = await file.arrayBuffer()
        await importProfile(Buffer.from(arrayBuffer))
      } catch (e: any) {
        setError(e.message ?? 'Import failed')
      }
    }
    input.click()
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Browser Profiles"
        subtitle={`${profiles.length} profiles · ${activeSessions.length} running`}
        search={search}
        onSearchChange={setSearch}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={fetchProfiles} className="btn-ghost p-2 rounded-lg" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => { setSelectionMode((v) => !v); setSelected(new Set()) }}
              className={`btn-ghost flex items-center gap-2 text-sm ${selectionMode ? 'text-ghost-400' : ''}`}
              title="Toggle selection mode"
            >
              <CheckSquare className="w-4 h-4" />
              {selectionMode ? 'Cancel' : 'Select'}
            </button>
            <button
              onClick={() => setShowCollisions(true)}
              className="btn-ghost flex items-center gap-2 text-sm"
              title="Scan for fingerprint collisions across profiles"
            >
              <ShieldAlert className="w-4 h-4" />
              Check collisions
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" />
              New Profile
            </button>
          </div>
        }
      />

      {/* Group filter bar — always visible so user can create first group */}
      <div className="px-6 pt-3 pb-1 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveGroup(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeGroup === null
                ? 'bg-ghost-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          {groups.map((g) => (
            <div key={g.id} className="flex items-center gap-1 group/grp">
              <button
                onClick={() => setActiveGroup(activeGroup === g.id ? null : g.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeGroup === g.id ? 'text-white' : 'text-slate-400 hover:text-white bg-slate-700'
                }`}
                style={activeGroup === g.id ? { backgroundColor: g.color } : {}}
              >
                {g.name}
              </button>
              <button
                onClick={() => handleDeleteGroup(g.id, g.name)}
                className="hidden group-hover/grp:flex w-4 h-4 items-center justify-center text-slate-500 hover:text-red-400 transition-colors"
                title="Delete group"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {showNewGroup ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewGroupColor(c)}
                    className={`w-4 h-4 rounded-full transition-transform ${newGroupColor === c ? 'scale-125 ring-2 ring-white/30' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <input
                className="input h-7 w-32 text-xs px-2"
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateGroup()
                  if (e.key === 'Escape') setShowNewGroup(false)
                }}
                autoFocus
              />
              <button onClick={handleCreateGroup} className="btn-primary text-xs px-2 py-1">Add</button>
              <button onClick={() => setShowNewGroup(false)} className="btn-ghost text-xs px-2 py-1">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewGroup(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <FolderPlus className="w-3 h-3" /> New group
            </button>
          )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-3 flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600/15 border border-red-600/30 text-red-400 text-sm">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {loading && profiles.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
            Loading profiles...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-center">
            <div className="text-4xl mb-3">👻</div>
            <p className="text-slate-400 font-medium">
              {profiles.length === 0 ? 'No profiles yet' : 'No profiles match'}
            </p>
            <p className="text-slate-500 text-sm mt-1 mb-4">
              {profiles.length === 0 ? 'Create your first browser profile to get started' : 'Try a different search or group'}
            </p>
            {profiles.length === 0 && (
              <button onClick={() => setShowCreate(true)} className="btn-primary text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create Profile
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((profile) => (
                <div
                  key={profile.id}
                  id={`profile-card-${profile.id}`}
                  className={`relative transition-shadow ${
                    highlightId === profile.id
                      ? 'ring-2 ring-amber-400 rounded-xl shadow-lg shadow-amber-500/20'
                      : ''
                  }`}
                >
                  {selectionMode && (
                    <div
                      className="absolute inset-0 z-10 flex items-start justify-end p-2 cursor-pointer"
                      onClick={() => toggleSelect(profile.id)}
                    >
                      <input
                        type="checkbox"
                        readOnly
                        checked={selected.has(profile.id)}
                        className="w-4 h-4 accent-indigo-500 cursor-pointer"
                      />
                    </div>
                  )}
                  <ProfileCard
                    profile={profile}
                    isActive={activeSessions.includes(profile.id)}
                    isLaunching={launching === profile.id}
                    onLaunch={() => handleLaunch(profile.id)}
                    onClose={() => closeProfile(profile.id)}
                    onEdit={() => setEditProfile(profile)}
                    onClone={() => handleClone(profile.id)}
                    onDelete={() => handleDelete(profile.id)}
                    onImportCookies={() => setCookieModal({ profile, mode: 'browse' })}
                    onExportCookies={() => setCookieModal({ profile, mode: 'export' })}
                    onStorage={() => setStorageProfile(profile)}
                    onExportBundle={() => handleExportBundle(profile.id)}
                    onImportBundle={handleImportBundle}
                    onHistory={() => setHistoryProfile(profile)}
                    onExtensions={() => setExtensionsProfile(profile)}
                    onWarmUp={() => setWarmUpProfile(profile)}
                    onApplyDrift={() => handleApplyDrift(profile)}
                  />
                </div>
              ))}
            </div>

            {/* Sticky bulk-action bar */}
            {selected.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-3
                              bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl">
                <span className="text-sm text-slate-300 font-medium">{selected.size} selected</span>
                <div className="w-px h-4 bg-slate-600" />
                <button onClick={handleBulkClone} className="btn-ghost text-xs flex items-center gap-1.5">
                  Clone all
                </button>
                <button onClick={handleBulkDelete} className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                               text-red-400 hover:bg-red-600/20 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete all
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreateProfileModal onClose={() => { setShowCreate(false); fetchProfiles() }} />
      )}
      {editProfile && (
        <EditProfileModal profile={editProfile} onClose={() => setEditProfile(null)} />
      )}
      {cookieModal && (
        <CookieModal
          profileId={cookieModal.profile.id}
          mode={cookieModal.mode}
          isActive={activeSessions.includes(cookieModal.profile.id)}
          onClose={() => setCookieModal(null)}
        />
      )}
      {storageProfile && (
        <StorageInspectorModal
          profileId={storageProfile.id}
          profileName={storageProfile.name}
          onClose={() => setStorageProfile(null)}
        />
      )}
      {historyProfile && (
        <ProfileHistory
          profile={historyProfile}
          onClose={() => setHistoryProfile(null)}
          onRestored={() => { fetchProfiles(); setHistoryProfile(null) }}
        />
      )}
      {extensionsProfile && (
        <ExtensionsModal
          profile={extensionsProfile}
          onClose={() => setExtensionsProfile(null)}
        />
      )}
      {warmUpProfile && (
        <WarmUpModal
          profile={warmUpProfile}
          isActive={activeSessions.includes(warmUpProfile.id)}
          onLaunch={() => handleLaunch(warmUpProfile.id)}
          onClose={() => { setWarmUpProfile(null); fetchProfiles() }}
        />
      )}
      {showCollisions && (
        <CollisionsDrawer
          onPickProfile={handlePickCollisionProfile}
          onClose={() => setShowCollisions(false)}
        />
      )}
    </div>
  )
}
