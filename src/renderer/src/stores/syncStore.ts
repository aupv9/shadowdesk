import { create } from 'zustand'
import type { SyncState, SyncManifest } from '../types'

interface SyncStore {
  state: SyncState
  manifest: SyncManifest | null
  manifestLoaded: boolean
  loading: boolean
  manifestLoading: boolean
  error: string | null

  fetchStatus:   () => Promise<void>
  push:          (password: string) => Promise<void>
  pull:          (password: string) => Promise<number>
  fetchManifest: () => Promise<void>
  updateState:   (state: SyncState) => void
}

export const useSyncStore = create<SyncStore>((set) => ({
  state: { status: 'idle', last_synced_at: null, pending_changes: 0 },
  manifest: null,
  manifestLoaded: false,
  loading: false,
  manifestLoading: false,
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
    }
  },

  pull: async (password) => {
    set({ loading: true, error: null })
    try {
      const count = await window.api.sync.pull(password)
      const state = await window.api.sync.status()
      set({ state, loading: false })
      return count
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
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

  updateState: (state) => {
    set({ state })
  }
}))
