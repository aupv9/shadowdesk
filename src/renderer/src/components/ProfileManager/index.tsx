import React, { useEffect, useMemo, useState } from 'react'
import {
  Plus, RefreshCw, X, FolderPlus, CheckSquare, ShieldAlert, Upload, MonitorX,
  LayoutGrid, List, ArrowDownAZ, ArrowUpAZ, CalendarClock, CalendarPlus,
} from 'lucide-react'
import { useProfileStore } from '../../stores/profileStore'
import { useProxyStore } from '../../stores/proxyStore'
import { useGroupStore } from '../../stores/groupStore'
import { useLicenseStore } from '../../stores/licenseStore'
import { useToastStore } from '../../stores/toastStore'
import { useConfirm } from '../UI/ConfirmDialog'
import { EmptyState } from '../UI/EmptyState'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { ProfileCard } from './ProfileCard'
import { ProfileListRow } from './ProfileListRow'
import { ProfileStatsBar, type QuickFilter } from './ProfileStatsBar'
import { CreateProfileModal } from './CreateProfileModal'
import { EditProfileModal } from './EditProfileModal'
import { CookieModal } from './CookieModal'
import { StorageInspectorModal } from './StorageInspectorModal'
import { ProfileHistory } from './ProfileHistory'
import { ExtensionsModal } from './ExtensionsModal'
import { WarmUpModal } from './WarmUpModal'
import { CollisionsDrawer } from './CollisionsDrawer'
import { ImportGuideModal } from './ImportGuideModal'
import { useImportStore } from '../../stores/importStore'
// Phase 3 components
import { PaginationControls } from './PaginationControls'
import { CleanupMonitor } from './CleanupMonitor'
import { BulkActionsToolbar } from './BulkActionsToolbar'
import { Header } from '../Layout/Header'
import type { Profile } from '../../types'

/** Sort options for the profile list. Persisted via `useLocalStorage`. */
type SortKey = 'name-asc' | 'name-desc' | 'last-used' | 'created-desc' | 'created-asc'
type ViewMode = 'grid' | 'list'

const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ReactNode }[] = [
  { key: 'name-asc',     label: 'Name (A→Z)',     icon: <ArrowDownAZ className="w-3.5 h-3.5" /> },
  { key: 'name-desc',    label: 'Name (Z→A)',     icon: <ArrowUpAZ className="w-3.5 h-3.5" /> },
  { key: 'last-used',    label: 'Last used',      icon: <CalendarClock className="w-3.5 h-3.5" /> },
  { key: 'created-desc', label: 'Newest first',   icon: <CalendarPlus className="w-3.5 h-3.5" /> },
  { key: 'created-asc',  label: 'Oldest first',   icon: <CalendarPlus className="w-3.5 h-3.5" /> },
]

const GROUP_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']

export function ProfileManager() {
  const {
    profiles, activeSessions, loading,
    pagination, paginationEnabled,
    fetchProfiles, fetchActiveSessions, fetchProfilesPaginated,
    setPaginationEnabled, setPaginationLimit, goToPage,
    launchProfile, closeProfile, deleteProfile, cloneProfile,
    bulkDeleteProfiles, bulkRestoreProfiles, bulkAssignProxy, bulkAssignGroup,
    bulkLaunchProfiles, bulkCloseProfiles,
    exportProfile, importProfile, setSyncExcluded
  } = useProfileStore()
  // Phase 4.3: undo toast support
  const pushToastWithAction = useToastStore((s) => s.pushWithAction)
  const { fetchProxies } = useProxyStore()
  const { groups, fetchGroups, createGroup, deleteGroup } = useGroupStore()
  const { checkProfileLimit, fetchUsage } = useLicenseStore()
  const pushToast = useToastStore((s) => s.push)
  const confirm = useConfirm()
  const openBulkImport = useImportStore((s) => s.openWizard)

  const [importing, setImporting] = useState(false)

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
  const [showImportGuide, setShowImportGuide] = useState(false)
  const [highlightId,    setHighlightId]    = useState<string | null>(null)

  // Preferences persisted to localStorage so power users don't need to
  // re-set their preferred view every time they re-open the app.
  const [viewMode,    setViewMode]    = useLocalStorage<ViewMode>('ghostbrowser.profiles.viewMode', 'grid')
  const [sortKey,     setSortKey]     = useLocalStorage<SortKey>('ghostbrowser.profiles.sortKey', 'last-used')
  const [quickFilter, setQuickFilter] = useLocalStorage<QuickFilter>('ghostbrowser.profiles.quickFilter', 'all')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)

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

  // Computed stats — always from the full list so they stay meaningful
  // regardless of the currently applied filters.
  const stats = useMemo(() => ({
    total: profiles.length,
    running: profiles.filter((p) => activeSessions.includes(p.id)).length,
    warmed: profiles.filter((p) => !!p.warmed_up).length,
    noProxy: profiles.filter((p) => !p.proxy_id).length,
    neverUsed: profiles.filter((p) => !p.last_used_at).length,
  }), [profiles, activeSessions])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const list = profiles.filter((p) => {
      const matchSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.notes ?? '').toLowerCase().includes(q) ||
        p.fingerprint.os.platform.toLowerCase().includes(q) ||
        (p.proxy_label ?? '').toLowerCase().includes(q)
      const matchGroup = activeGroup === null || p.group_id === activeGroup
      let matchQuick = true
      switch (quickFilter) {
        case 'running':    matchQuick = activeSessions.includes(p.id); break
        case 'warmed':     matchQuick = !!p.warmed_up; break
        case 'no-proxy':   matchQuick = !p.proxy_id; break
        case 'never-used': matchQuick = !p.last_used_at; break
        default:           matchQuick = true
      }
      return matchSearch && matchGroup && matchQuick
    })

    // Sort in-place on a copy — mutating `profiles` would confuse Zustand.
    const sorted = [...list]
    const byName = (a: Profile, b: Profile) => a.name.localeCompare(b.name)
    const ts = (v: string | undefined | null) => (v ? new Date(v).getTime() : 0)
    switch (sortKey) {
      case 'name-asc':     sorted.sort(byName); break
      case 'name-desc':    sorted.sort((a, b) => byName(b, a)); break
      case 'last-used':    sorted.sort((a, b) => ts(b.last_used_at) - ts(a.last_used_at)); break
      case 'created-desc': sorted.sort((a, b) => ts(b.created_at) - ts(a.created_at)); break
      case 'created-asc':  sorted.sort((a, b) => ts(a.created_at) - ts(b.created_at)); break
    }
    return sorted
  }, [profiles, search, activeGroup, quickFilter, sortKey, activeSessions])

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
    const profile = profiles.find((p) => p.id === id)
    const ok = await confirm({
      title: 'Delete Profile',
      message: `Delete "${profile?.name ?? 'this profile'}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    await deleteProfile(id)
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    await createGroup({ name: newGroupName.trim(), color: newGroupColor })
    setNewGroupName('')
    setShowNewGroup(false)
  }

  const handleDeleteGroup = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Delete Group',
      message: `Delete group "${name}"? Profiles in this group will become ungrouped.`,
      confirmLabel: 'Delete Group',
      destructive: true,
    })
    if (!ok) return
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
    const ok = await confirm({
      title: `Delete ${selected.size} Profile${selected.size !== 1 ? 's' : ''}`,
      message: `This will delete ${selected.size} profile${selected.size !== 1 ? 's' : ''}. You'll have a short undo window before cleanup runs.`,
      confirmLabel: `Delete ${selected.size}`,
      destructive: true,
    })
    if (!ok) return
    try {
      // Phase 3: Use new bulk delete API (async cleanup worker)
      const ids = Array.from(selected)
      const result = await bulkDeleteProfiles(ids)
      const count = result.deleted
      const undoMs = result.undoWindowMs ?? 10_000
      setSelected(new Set())
      setSelectionMode(false)

      // Phase 4.3: Show undoable toast — clicking Undo restores the profiles
      // and cancels the pending cleanup tasks. Toast auto-dismisses when the
      // undo window closes.
      pushToastWithAction(
        `Deleted ${count} profile${count !== 1 ? 's' : ''}`,
        {
          label: 'Undo',
          onClick: async () => {
            try {
              const r = await bulkRestoreProfiles(ids)
              pushToast(
                `Restored ${r.restored} profile${r.restored !== 1 ? 's' : ''}`,
                'success',
              )
            } catch (err: any) {
              pushToast(err.message ?? 'Undo failed', 'error')
            }
          },
        },
        'success',
        undoMs,
      )
    } catch (e: any) {
      pushToast(e.message ?? 'Bulk delete failed', 'error')
    }
  }

  const handleBulkClone = async () => {
    for (const id of selected) {
      await cloneProfile(id)
    }
    pushToast(`Cloned ${selected.size} profile${selected.size !== 1 ? 's' : ''}`, 'success')
    setSelected(new Set())
    setSelectionMode(false)
  }

  // Phase 3: Bulk assign proxy to selected profiles
  const handleBulkAssignProxy = async (proxyId: string | null) => {
    try {
      const ids = Array.from(selected)
      const result = await bulkAssignProxy(ids, proxyId)
      pushToast(
        proxyId
          ? `Assigned proxy to ${result.updated} profile${result.updated !== 1 ? 's' : ''}`
          : `Unassigned proxy from ${result.updated} profile${result.updated !== 1 ? 's' : ''}`,
        'success',
      )
    } catch (e: any) {
      pushToast(e.message ?? 'Bulk proxy assignment failed', 'error')
    }
  }

  // Phase 3: Bulk assign group to selected profiles
  const handleBulkAssignGroup = async (groupId: string | null) => {
    try {
      const ids = Array.from(selected)
      const result = await bulkAssignGroup(ids, groupId)
      pushToast(
        groupId
          ? `Assigned group to ${result.updated} profile${result.updated !== 1 ? 's' : ''}`
          : `Ungrouped ${result.updated} profile${result.updated !== 1 ? 's' : ''}`,
        'success',
      )
    } catch (e: any) {
      pushToast(e.message ?? 'Bulk group assignment failed', 'error')
    }
  }

  // Bulk launch multiple profiles in parallel
  const handleBulkLaunch = async () => {
    try {
      const ids = Array.from(selected)
      const result = await bulkLaunchProfiles(ids)
      if (result.launched > 0) {
        pushToast(
          `Launched ${result.launched} profile${result.launched !== 1 ? 's' : ''}${
            result.failed > 0 ? ` (${result.failed} failed)` : ''
          }`,
          'success',
        )
      } else if (result.failed > 0) {
        pushToast(`Failed to launch ${result.failed} profile${result.failed !== 1 ? 's' : ''}`, 'error')
      }
    } catch (e: any) {
      pushToast(e.message ?? 'Bulk launch failed', 'error')
    }
  }

  // Bulk close multiple profiles in parallel
  const handleBulkClose = async () => {
    try {
      const ids = Array.from(selected)
      const result = await bulkCloseProfiles(ids)
      if (result.closed > 0) {
        pushToast(
          `Closed ${result.closed} profile${result.closed !== 1 ? 's' : ''}${
            result.failed > 0 ? ` (${result.failed} failed)` : ''
          }`,
          'success',
        )
      } else if (result.failed > 0) {
        pushToast(`Failed to close ${result.failed} profile${result.failed !== 1 ? 's' : ''}`, 'error')
      }
    } catch (e: any) {
      pushToast(e.message ?? 'Bulk close failed', 'error')
    }
  }

  // Phase 3: Select all visible profiles on the current page
  const handleSelectAll = () => {
    const allIds = filtered.map((p) => p.id)
    const allCurrentlySelected = allIds.every((id) => selected.has(id))
    if (allCurrentlySelected) {
      // Deselect all on page
      setSelected((prev) => {
        const next = new Set(prev)
        allIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        allIds.forEach((id) => next.add(id))
        return next
      })
    }
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
    const ok = await confirm({
      title: 'Apply Fingerprint Drift',
      message: `Apply drift to "${profile.name}"? This bumps the Chrome version and rotates noise seeds.`,
      confirmLabel: 'Apply Drift',
    })
    if (!ok) return
    try {
      await window.api.drift.apply(profile.id)
      await fetchProfiles()
    } catch (e: any) {
      setError(e.message ?? 'Failed to apply drift')
    }
  }

  // Account C5 — flip selective-sync flag and toast the result.
  const handleToggleSyncExcluded = async (profile: Profile) => {
    const next = !profile.sync_excluded
    try {
      await setSyncExcluded(profile.id, next)
      pushToast(
        next
          ? `"${profile.name}" excluded from cloud sync`
          : `"${profile.name}" included in cloud sync`,
        'success'
      )
    } catch (e: any) {
      pushToast(e?.message ?? 'Failed to update sync setting', 'error')
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

  /**
   * Entry-point for the top-level Import button. Shows the format guide
   * modal first (with what's-included / what's-not / multi-select tip), or
   * skips straight to the file picker if the user previously dismissed it.
   */
  const handleImportClick = () => {
    if (importing) return
    let dismissed = false
    try {
      dismissed = localStorage.getItem('ghostbrowser.importGuideDismissed') === '1'
    } catch {
      // localStorage may be disabled — fall back to always showing the guide
    }
    if (dismissed) {
      pickAndImport()
    } else {
      setShowImportGuide(true)
    }
  }

  /**
   * Multi-profile import. Pops a file picker that accepts N `.zip` bundles,
   * runs a license-limit pre-check, then imports them sequentially. Each
   * bundle reuses the audited single-profile import path so we don't open
   * up a new format surface. Per-file failures don't abort the batch — the
   * summary toast tells the user how many succeeded/failed.
   */
  const pickAndImport = async () => {
    if (importing) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip'
    input.multiple = true
    input.onchange = async () => {
      const files = Array.from(input.files ?? [])
      if (files.length === 0) return

      // Pre-flight license-limit check. -1 = unlimited.
      try {
        const limit = await checkProfileLimit()
        if (limit.max !== -1 && limit.current + files.length > limit.max) {
          const remaining = Math.max(0, limit.max - limit.current)
          const msg = remaining === 0
            ? `Profile limit reached (${limit.current}/${limit.max}). Upgrade your plan to import more.`
            : `Importing ${files.length} would exceed your plan limit (${limit.current}/${limit.max}). Only the first ${remaining} will be imported.`
          if (!window.confirm(msg + '\n\nContinue?')) return
          // Truncate to whatever the plan allows
          files.length = remaining
        }
      } catch {
        // If the limit check itself fails, fall through and let the per-file
        // import surface the real error rather than blocking the whole flow.
      }

      setImporting(true)
      setError(null)
      let succeeded = 0
      const failures: string[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          const arrayBuffer = await file.arrayBuffer()
          await importProfile(Buffer.from(arrayBuffer))
          succeeded += 1
          pushToast(`Imported ${i + 1}/${files.length}: ${file.name}`, 'info', 1500)
        } catch (e: any) {
          failures.push(`${file.name}: ${e.message ?? 'unknown error'}`)
        }
      }

      setImporting(false)
      await fetchUsage()

      if (failures.length === 0) {
        pushToast(`Imported ${succeeded} profile${succeeded !== 1 ? 's' : ''}`, 'success')
      } else if (succeeded === 0) {
        setError(`All ${failures.length} import${failures.length !== 1 ? 's' : ''} failed:\n` + failures.join('\n'))
      } else {
        pushToast(`Imported ${succeeded} of ${succeeded + failures.length} (${failures.length} failed)`, 'info')
        setError('Some imports failed:\n' + failures.join('\n'))
      }
    }
    input.click()
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Browser Profiles"
        subtitle={
          filtered.length !== profiles.length
            ? `${filtered.length} shown · ${profiles.length} total · ${activeSessions.length} running`
            : `${profiles.length} profiles · ${activeSessions.length} running`
        }
        search={search}
        onSearchChange={setSearch}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={fetchProfiles} className="btn-ghost p-2 rounded-lg" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* View mode toggle — grid vs list. Persisted across sessions. */}
            <div className="flex items-center rounded-lg bg-slate-800 border border-slate-700 p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Sort dropdown. Current selection shown inline. */}
            <div className="relative">
              <button
                onClick={() => setSortMenuOpen((v) => !v)}
                className="btn-ghost flex items-center gap-2 text-sm"
                title="Sort profiles"
              >
                {SORT_OPTIONS.find((o) => o.key === sortKey)?.icon}
                <span className="hidden xl:inline">
                  {SORT_OPTIONS.find((o) => o.key === sortKey)?.label}
                </span>
              </button>
              {sortMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setSortMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-10 z-20 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-1">
                    {SORT_OPTIONS.map((o) => (
                      <button
                        key={o.key}
                        onClick={() => { setSortKey(o.key); setSortMenuOpen(false) }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors ${
                          sortKey === o.key
                            ? 'bg-ghost-600/20 text-ghost-300'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {o.icon}
                        {o.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Phase 3: Pagination mode toggle */}
            <button
              onClick={() => setPaginationEnabled(!paginationEnabled)}
              className={`btn-ghost flex items-center gap-2 text-sm ${paginationEnabled ? 'text-ghost-400' : ''}`}
              title={paginationEnabled ? 'Disable pagination (load all)' : 'Enable pagination (for large lists)'}
            >
              <LayoutGrid className="w-4 h-4" />
              {paginationEnabled ? 'Paged' : 'All'}
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
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Import one or more profile bundles (.ghost.zip)"
            >
              <Upload className={`w-4 h-4 ${importing ? 'animate-pulse' : ''}`} />
              {importing ? 'Importing…' : 'Import'}
            </button>
            <button
              onClick={openBulkImport}
              className="btn-ghost flex items-center gap-2 text-sm border border-indigo-500/30 hover:border-indigo-500/60 text-indigo-400"
              title="Bulk import profiles from CSV, JSON, or ZIP files with preview and duplicate detection"
            >
              <Upload className="w-4 h-4" />
              Bulk Import
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" />
              New Profile
            </button>
          </div>
        }
      />

      {/* Stats strip doubles as quick-filter chips */}
      <ProfileStatsBar stats={stats} active={quickFilter} onChange={setQuickFilter} />

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
          profiles.length === 0 ? (
            <EmptyState
              icon={MonitorX}
              title="No profiles yet"
              description="Create your first browser profile with a unique fingerprint to get started."
              actionLabel="Create Profile"
              onAction={() => setShowCreate(true)}
            />
          ) : (
            <EmptyState
              icon={MonitorX}
              title="No profiles match"
              description={
                quickFilter !== 'all'
                  ? 'Try clearing the quick filter above, changing your search, or switching groups.'
                  : 'Try a different search term or group filter.'
              }
              actionLabel={quickFilter !== 'all' ? 'Clear quick filter' : undefined}
              onAction={quickFilter !== 'all' ? () => setQuickFilter('all') : undefined}
            />
          )
        ) : viewMode === 'grid' ? (
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
                  onToggleSyncExcluded={() => handleToggleSyncExcluded(profile)}
                />
              </div>
            ))}
          </div>
        ) : (
          // List view — denser, scannable row layout. Shares the same action
          // set as ProfileCard via the overflow menu so feature parity is
          // preserved across both view modes.
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
            <div className="hidden md:flex items-center gap-4 px-4 py-2 text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800 bg-slate-800/40">
              {selectionMode && <span className="w-4" />}
              <span className="w-9" />
              <span className="flex-1">Profile</span>
              <span className="w-40">Proxy</span>
              <span className="hidden lg:inline w-24">Screen</span>
              <span className="hidden lg:inline w-28">Last used</span>
              <span className="w-[76px]">Action</span>
              <span className="w-7" />
            </div>
            {filtered.map((profile) => (
              <div
                key={profile.id}
                id={`profile-card-${profile.id}`}
                className={`transition-shadow ${
                  highlightId === profile.id
                    ? 'ring-2 ring-inset ring-amber-400 shadow-inner shadow-amber-500/20'
                    : ''
                }`}
              >
                <ProfileListRow
                  profile={profile}
                  isActive={activeSessions.includes(profile.id)}
                  isLaunching={launching === profile.id}
                  selected={selected.has(profile.id)}
                  selectionMode={selectionMode}
                  onToggleSelect={() => toggleSelect(profile.id)}
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
                  onToggleSyncExcluded={() => handleToggleSyncExcluded(profile)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Phase 3: Pagination controls — shown when pagination is enabled */}
        {paginationEnabled && profiles.length > 0 && (
          <PaginationControls
            total={pagination.total}
            limit={pagination.limit}
            offset={pagination.offset}
            hasMore={pagination.hasMore}
            onPageChange={goToPage}
            onLimitChange={setPaginationLimit}
          />
        )}
      </div>

      {/* Phase 3: Enhanced Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selected.size}
        onClearSelection={() => { setSelected(new Set()); setSelectionMode(false) }}
        onSelectAll={handleSelectAll}
        allSelected={filtered.length > 0 && filtered.every((p) => selected.has(p.id))}
        onBulkLaunch={handleBulkLaunch}
        onBulkClose={handleBulkClose}
        onBulkDelete={handleBulkDelete}
        onBulkClone={handleBulkClone}
        onBulkAssignProxy={handleBulkAssignProxy}
        onBulkAssignGroup={handleBulkAssignGroup}
      />

      {/* Phase 3: Cleanup worker progress monitor */}
      <CleanupMonitor />

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
      {showImportGuide && (
        <ImportGuideModal
          onClose={() => setShowImportGuide(false)}
          onConfirm={() => {
            setShowImportGuide(false)
            pickAndImport()
          }}
        />
      )}
    </div>
  )
}
