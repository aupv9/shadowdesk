import { create } from 'zustand'
import type { SyncState, SyncManifest, SyncLogEntry, SyncPullResult, SyncDiff } from '../types'
import { useToastStore } from './toastStore'

interface SyncStore {
  state: SyncState
  manifest: SyncManifest | null
  manifestLoaded: boolean
  loading: boolean
  manifestLoading: boolean
  history: SyncLogEntry[]
  historyLoaded: boolean
  historyLoading: boolean
  daemonEnabled: boolean
  error: string | null

  fetchStatus:   () => Promise<void>
  push:          (password: string) => Promise<void>
  pull:          (password: string) => Promise<SyncPullResult>
  fetchManifest: () => Promise<void>
  fetchHistory:  (limit?: number) => Promise<void>
  fetchDiff:     () => Promise<SyncDiff>
  fetchDaemonEnabled: () => Promise<void>
  enableDaemon:  (password: string) => Promise<void>
  disableDaemon: () => Promise<void>
  updateState:   (state: SyncState) => void
}

export const useSyncStore = create<SyncStore>((set) => ({
  state: { status: 'idle', last_synced_at: null, pending_changes: 0 },
  manifest: null,
  manifestLoaded: false,
  loading: false,
  manifestLoading: false,
  history: [],
  historyLoaded: false,
  historyLoading: false,
  daemonEnabled: false,
  error: null,

  fetchStatus: async () => {
    try {
      const state = await window.api.sync.status()
      set({ state })
    } catch { /* ignore */ }
  },

  push: async (password) => {
    set({ loading: true, error: null })
    try {
      await window.api.sync.push(password)
      const state = await window.api.sync.status()
      set({ state, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    } finally {
      // Refresh history regardless of success/failure so failed pushes
      // surface in the panel for diagnostics.
      try {
        const history = await window.api.sync.history(20)
        set({ history, historyLoaded: true })
      } catch { /* ignore */ }
    }
  },

  pull: async (password) => {
    set({ loading: true, error: null })
    try {
      const result = await window.api.sync.pull(password)
      const state = await window.api.sync.status()
      set({ state, loading: false })
      return result
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    } finally {
      try {
        const history = await window.api.sync.history(20)
        set({ history, historyLoaded: true })
      } catch { /* ignore */ }
    }
  },

  fetchManifest: async () => {
    set({ manifestLoading: true })
    try {
      const manifest = await window.api.sync.manifest()
      set({ manifest, manifestLoaded: true, manifestLoading: false })
    } catch {
      set({ manifestLoaded: true, manifestLoading: false })
    }
  },

  fetchHistory: async (limit = 20) => {
    set({ historyLoading: true })
    try {
      const history = await window.api.sync.history(limit)
      set({ history, historyLoaded: true, historyLoading: false })
    } catch {
      set({ historyLoaded: true, historyLoading: false })
    }
  },

  fetchDiff: async () => {
    return window.api.sync.diff()
  },

  fetchDaemonEnabled: async () => {
    try {
      const daemonEnabled = await window.api.sync.daemonEnabled()
      set({ daemonEnabled })
    } catch { /* ignore */ }
  },

  enableDaemon: async (password) => {
    await window.api.sync.enableDaemon(password)
    set({ daemonEnabled: true })
  },

  disableDaemon: async () => {
    await window.api.sync.disableDaemon()
    set({ daemonEnabled: false })
  },

  updateState: (state) => {
    set({ state })
  }
}))
