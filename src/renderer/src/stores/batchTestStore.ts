import { create } from 'zustand'
import type {
  BatchTestRun,
  BatchTestProgress,
  GestureOptimizationResult,
  MLModelStats,
  CrossProfileSyncGroup,
  SyncEvent,
  NetworkCondition,
  NetworkSimulationConfig
} from '../types'

/**
 * Phase 19 — Batch Testing + ML Optimization Store
 *
 * Manages state for:
 * - Batch detection test runs (create, track progress, view results)
 * - ML gesture optimization (training data, recommendations)
 * - Cross-profile behavior sync groups
 * - Network condition simulation
 */

interface BatchTestStoreState {
  // Batch tests
  batches: BatchTestRun[]
  selectedBatch: BatchTestRun | null
  batchProgress: BatchTestProgress | null
  // ML optimization
  optimizationResults: GestureOptimizationResult[]
  mlStats: MLModelStats | null
  // Cross-profile sync
  syncGroups: CrossProfileSyncGroup[]
  syncHistory: SyncEvent[]
  // Network simulation
  networkPresets: NetworkCondition[]
  activeSimulations: NetworkSimulationConfig[]
  // UI state
  loading: boolean
  error: string | null

  // Batch test actions
  fetchBatches: () => Promise<void>
  createBatch: (name: string, profileIds: string[], testType: string) => Promise<BatchTestRun>
  refreshBatch: (id: string) => Promise<void>
  pollProgress: (id: string) => Promise<void>
  cancelBatch: (id: string) => Promise<void>
  deleteBatch: (id: string) => Promise<void>

  // ML actions
  runOptimization: (profileId?: string) => Promise<void>
  fetchMLStats: () => Promise<void>

  // Sync actions
  fetchSyncGroups: () => Promise<void>
  createSyncGroup: (name: string, profileIds: string[], strategy: string) => Promise<void>
  syncGroup: (groupId: string, sourceProfileId: string) => Promise<void>
  deleteSyncGroup: (id: string) => Promise<void>
  fetchSyncHistory: (groupId: string) => Promise<void>

  // Network actions
  fetchNetworkPresets: () => Promise<void>
  applyNetwork: (profileId: string, preset: string) => Promise<void>
  clearNetwork: (profileId: string) => Promise<void>
  fetchActiveSimulations: () => Promise<void>
}

export const useBatchTestStore = create<BatchTestStoreState>((set, get) => ({
  batches: [],
  selectedBatch: null,
  batchProgress: null,
  optimizationResults: [],
  mlStats: null,
  syncGroups: [],
  syncHistory: [],
  networkPresets: [],
  activeSimulations: [],
  loading: false,
  error: null,

  // ── Batch Test Actions ──────────────────────────────────────────────────

  fetchBatches: async () => {
    set({ loading: true, error: null })
    try {
      const batches = await window.api.batch.list()
      set({ batches, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  createBatch: async (name, profileIds, testType) => {
    set({ loading: true, error: null })
    try {
      const batch = await window.api.batch.create({ name, profileIds, testType })
      set((s) => ({ batches: [batch, ...s.batches], selectedBatch: batch, loading: false }))
      return batch
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    }
  },

  refreshBatch: async (id) => {
    try {
      const batch = await window.api.batch.get(id)
      if (!batch) return
      set((s) => ({
        batches: s.batches.map((b) => (b.id === id ? batch : b)),
        selectedBatch: s.selectedBatch?.id === id ? batch : s.selectedBatch
      }))
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  pollProgress: async (id) => {
    try {
      const progress = await window.api.batch.progress(id)
      set({ batchProgress: progress })
    } catch {
      // Ignore polling errors
    }
  },

  cancelBatch: async (id) => {
    try {
      await window.api.batch.cancel(id)
      get().refreshBatch(id)
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  deleteBatch: async (id) => {
    try {
      await window.api.batch.delete(id)
      set((s) => ({
        batches: s.batches.filter((b) => b.id !== id),
        selectedBatch: s.selectedBatch?.id === id ? null : s.selectedBatch
      }))
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  // ── ML Actions ──────────────────────────────────────────────────────────

  runOptimization: async (profileId) => {
    set({ loading: true, error: null })
    try {
      const results = await window.api.ml.optimize(profileId)
      set({ optimizationResults: results, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchMLStats: async () => {
    try {
      const stats = await window.api.ml.stats()
      set({ mlStats: stats })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  // ── Sync Actions ────────────────────────────────────────────────────────

  fetchSyncGroups: async () => {
    try {
      const groups = await window.api.profileSync.listGroups()
      set({ syncGroups: groups })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  createSyncGroup: async (name, profileIds, strategy) => {
    try {
      const group = await window.api.profileSync.createGroup({ name, profileIds, strategy })
      set((s) => ({ syncGroups: [group, ...s.syncGroups] }))
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  syncGroup: async (groupId, sourceProfileId) => {
    try {
      await window.api.profileSync.sync(groupId, sourceProfileId)
      get().fetchSyncGroups()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  deleteSyncGroup: async (id) => {
    try {
      await window.api.profileSync.deleteGroup(id)
      set((s) => ({ syncGroups: s.syncGroups.filter((g) => g.id !== id) }))
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchSyncHistory: async (groupId) => {
    try {
      const history = await window.api.profileSync.history(groupId)
      set({ syncHistory: history })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  // ── Network Actions ─────────────────────────────────────────────────────

  fetchNetworkPresets: async () => {
    try {
      const presets = await window.api.network.presets()
      set({ networkPresets: presets })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  applyNetwork: async (profileId, preset) => {
    try {
      await window.api.network.apply(profileId, preset)
      get().fetchActiveSimulations()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  clearNetwork: async (profileId) => {
    try {
      await window.api.network.clear(profileId)
      set((s) => ({
        activeSimulations: s.activeSimulations.filter((a) => a.profileId !== profileId)
      }))
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchActiveSimulations: async () => {
    try {
      const sims = await window.api.network.listActive()
      set({ activeSimulations: sims })
    } catch (e: any) {
      set({ error: e.message })
    }
  }
}))
