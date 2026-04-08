import { create } from 'zustand'
import type { Profile, CreateProfileInput } from '../types'

// Phase 3: Pagination state
interface PaginationState {
  limit: number
  offset: number
  total: number
  hasMore: boolean
  filters?: {
    groupId?: string
    status?: 'active' | 'archived'
  }
}

interface ProfileState {
  profiles: Profile[]
  activeSessions: string[]
  loading: boolean
  error: string | null

  // Phase 3: pagination state
  pagination: PaginationState
  paginationEnabled: boolean

  fetchProfiles:      ()                              => Promise<void>
  // Phase 3: paginated fetch
  fetchProfilesPaginated: (opts?: { limit?: number; offset?: number; filters?: any; append?: boolean }) => Promise<void>
  setPaginationEnabled: (enabled: boolean)            => void
  setPaginationLimit: (limit: number)                 => void
  goToPage: (page: number)                            => Promise<void>
  fetchActiveSessions: ()                             => Promise<void>
  createProfile:      (input: CreateProfileInput)     => Promise<void>
  updateProfile:      (id: string, data: any)         => Promise<void>
  cloneProfile:       (id: string)                    => Promise<void>
  deleteProfile:      (id: string)                    => Promise<void>
  // Phase 3: bulk operations
  bulkDeleteProfiles: (ids: string[])                 => Promise<{ deleted: number; undoWindowMs?: number }>
  // Phase 4.3: undo bulk-delete
  bulkRestoreProfiles: (ids: string[])                => Promise<{ restored: number; cancelledCleanups: number }>
  bulkAssignProxy:    (ids: string[], proxyId: string | null) => Promise<{ updated: number }>
  bulkAssignGroup:    (ids: string[], groupId: string | null) => Promise<{ updated: number }>
  bulkLaunchProfiles: (ids: string[])                 => Promise<{ launched: number; failed: number }>
  bulkCloseProfiles:  (ids: string[])                 => Promise<{ closed: number; failed: number }>
  launchProfile:      (id: string)                    => Promise<void>
  closeProfile:       (id: string)                    => Promise<void>
  rerollFingerprint:  (id: string)                    => Promise<void>
  setGroup:           (profileId: string, groupId: string | null) => Promise<void>
  setSyncExcluded:    (profileId: string, excluded: boolean)       => Promise<void>
  exportProfile:      (id: string)                    => Promise<Buffer>
  importProfile:      (buffer: Buffer)                => Promise<void>
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  activeSessions: [],
  loading: false,
  error: null,

  // Phase 3: pagination state
  pagination: {
    limit: 50,
    offset: 0,
    total: 0,
    hasMore: false,
  },
  paginationEnabled: false,

  fetchProfiles: async () => {
    set({ loading: true, error: null })
    try {
      // Phase 3: use paginated fetch if enabled
      if (get().paginationEnabled) {
        await get().fetchProfilesPaginated()
        return
      }
      const profiles = await window.api.profiles.list()
      set({ profiles: profiles.map(parseProfile), loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  // Phase 3: Paginated profile fetch
  fetchProfilesPaginated: async (opts) => {
    set({ loading: true, error: null })
    try {
      const current = get().pagination
      const limit = opts?.limit ?? current.limit
      const offset = opts?.offset ?? 0
      const filters = opts?.filters ?? current.filters

      const result = await window.api.profiles.listPaginated(limit, offset, filters)
      const parsedProfiles = (result.profiles ?? []).map(parseProfile)

      set((s) => ({
        profiles: opts?.append ? [...s.profiles, ...parsedProfiles] : parsedProfiles,
        pagination: {
          limit,
          offset,
          total: result.total ?? 0,
          hasMore: result.hasMore ?? false,
          filters,
        },
        loading: false,
      }))
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  setPaginationEnabled: (enabled: boolean) => {
    set({ paginationEnabled: enabled })
    if (enabled) {
      get().fetchProfilesPaginated({ offset: 0 })
    } else {
      get().fetchProfiles()
    }
  },

  setPaginationLimit: (limit: number) => {
    const normalized = Math.max(1, Math.min(limit, 100))
    set((s) => ({
      pagination: { ...s.pagination, limit: normalized, offset: 0 },
    }))
    if (get().paginationEnabled) {
      get().fetchProfilesPaginated({ limit: normalized, offset: 0 })
    }
  },

  goToPage: async (page: number) => {
    const { limit } = get().pagination
    const offset = Math.max(0, (page - 1) * limit)
    await get().fetchProfilesPaginated({ offset })
  },

  fetchActiveSessions: async () => {
    try {
      const activeSessions = await window.api.profiles.active()
      set({ activeSessions })
    } catch {
      // ignore
    }
  },

  createProfile: async (input: CreateProfileInput) => {
    set({ loading: true, error: null })
    try {
      const profile = await window.api.profiles.create(input)
      set((s) => ({ profiles: [parseProfile(profile), ...s.profiles], loading: false }))
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    }
  },

  updateProfile: async (id: string, data: any) => {
    const profile = await window.api.profiles.update(id, data)
    set((s) => ({
      profiles: s.profiles.map((p) => (p.id === id ? parseProfile(profile) : p))
    }))
  },

  cloneProfile: async (id: string) => {
    const profile = await window.api.profiles.clone(id)
    set((s) => ({ profiles: [parseProfile(profile), ...s.profiles] }))
  },

  deleteProfile: async (id: string) => {
    await window.api.profiles.delete(id)
    set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }))
  },

  // Phase 3: Bulk delete via new backend API (uses async cleanup worker)
  // Phase 4.3: Returns undoWindowMs so UI can show an undo toast
  bulkDeleteProfiles: async (ids: string[]) => {
    if (ids.length === 0) return { deleted: 0 }
    // Optimistic UI update
    const prev = get().profiles
    set((s) => ({ profiles: s.profiles.filter((p) => !ids.includes(p.id)) }))
    try {
      const result = await window.api.profiles.bulkDelete(ids)
      return result as { deleted: number; undoWindowMs?: number }
    } catch (e: any) {
      // Rollback on failure
      set({ profiles: prev, error: e.message })
      throw e
    }
  },

  // Phase 4.3: Restore archived profiles (undo bulk-delete)
  bulkRestoreProfiles: async (ids: string[]) => {
    if (ids.length === 0) return { restored: 0, cancelledCleanups: 0 }
    try {
      const result = await window.api.profiles.bulkRestore(ids)
      // Refresh the full list to get the restored profiles back
      await get().fetchProfiles()
      return result as { restored: number; cancelledCleanups: number }
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  // Phase 3: Bulk assign proxy
  bulkAssignProxy: async (ids: string[], proxyId: string | null) => {
    if (ids.length === 0) return { updated: 0 }
    try {
      const result = await window.api.profiles.bulkAssignProxy(ids, proxyId)
      // Refresh to get updated proxy labels
      await get().fetchProfiles()
      return result as { updated: number }
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  // Phase 3: Bulk assign group
  bulkAssignGroup: async (ids: string[], groupId: string | null) => {
    if (ids.length === 0) return { updated: 0 }
    try {
      const result = await window.api.profiles.bulkAssignGroup(ids, groupId)
      // Refresh to get updated group info
      await get().fetchProfiles()
      return result as { updated: number }
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  launchProfile: async (id: string) => {
    await window.api.profiles.launch(id)
    set((s) => ({ activeSessions: [...new Set([...s.activeSessions, id])] }))
  },

  closeProfile: async (id: string) => {
    await window.api.profiles.close(id)
    set((s) => ({ activeSessions: s.activeSessions.filter((x) => x !== id) }))
  },

  // Bulk launch multiple profiles in parallel
  bulkLaunchProfiles: async (ids: string[]) => {
    if (ids.length === 0) return { launched: 0, failed: 0 }
    let launched = 0
    let failed = 0
    const launchedIds: string[] = []

    try {
      // Launch all profiles in parallel with Promise.allSettled to handle individual failures
      const results = await Promise.allSettled(
        ids.map((id) => window.api.profiles.launch(id))
      )

      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled') {
          launched++
          launchedIds.push(ids[i])
        } else {
          failed++
        }
      }

      // Update active sessions with all successfully launched profiles
      if (launchedIds.length > 0) {
        set((s) => ({
          activeSessions: [...new Set([...s.activeSessions, ...launchedIds])]
        }))
      }

      return { launched, failed }
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  // Bulk close multiple profiles in parallel
  bulkCloseProfiles: async (ids: string[]) => {
    if (ids.length === 0) return { closed: 0, failed: 0 }
    let closed = 0
    let failed = 0
    const closedIds: string[] = []

    try {
      // Close all profiles in parallel with Promise.allSettled to handle individual failures
      const results = await Promise.allSettled(
        ids.map((id) => window.api.profiles.close(id))
      )

      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled') {
          closed++
          closedIds.push(ids[i])
        } else {
          failed++
        }
      }

      // Update active sessions by removing all successfully closed profiles
      if (closedIds.length > 0) {
        set((s) => ({
          activeSessions: s.activeSessions.filter((x) => !closedIds.includes(x))
        }))
      }

      return { closed, failed }
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  rerollFingerprint: async (id: string) => {
    const profile = await window.api.profiles.rerollFingerprint(id)
    set((s) => ({
      profiles: s.profiles.map((p) => (p.id === id ? parseProfile(profile) : p))
    }))
  },

  setGroup: async (profileId: string, groupId: string | null) => {
    await window.api.profiles.setGroup(profileId, groupId)
    await get().fetchProfiles()
  },

  // C5 — selective sync. Optimistically updates local state then commits.
  setSyncExcluded: async (profileId: string, excluded: boolean) => {
    set((s) => ({
      profiles: s.profiles.map((p) =>
        p.id === profileId ? { ...p, sync_excluded: excluded ? 1 : 0 } : p
      )
    }))
    try {
      await window.api.profiles.setSyncExcluded(profileId, excluded)
    } catch (e) {
      // Revert on failure
      set((s) => ({
        profiles: s.profiles.map((p) =>
          p.id === profileId ? { ...p, sync_excluded: excluded ? 0 : 1 } : p
        )
      }))
      throw e
    }
  },

  exportProfile: async (id: string) => {
    return window.api.profiles.export(id)
  },

  importProfile: async (buffer: Buffer) => {
    const profile = await window.api.profiles.import(buffer)
    set((s) => ({ profiles: [parseProfile(profile), ...s.profiles] }))
  }
}))

function parseProfile(raw: any): Profile {
  return {
    ...raw,
    fingerprint: typeof raw.fingerprint === 'string' ? JSON.parse(raw.fingerprint) : raw.fingerprint
  }
}
