import { create } from 'zustand'

/**
 * Phase 3: Cleanup Worker Monitor Store
 *
 * Tracks the status of the async profile cleanup worker that runs in the main process.
 * Provides real-time visibility into pending, processing, and failed cleanup tasks.
 */

interface CleanupStatus {
  queued: number
  processing: number
  failed: number
  total: number
}

interface CleanupStoreState {
  status: CleanupStatus
  polling: boolean
  error: string | null

  fetchStatus:        () => Promise<void>
  startPolling:       (intervalMs?: number) => void
  stopPolling:        () => void
  retryFailed:        () => Promise<void>
  clearFailed:        () => Promise<void>
}

let pollingTimer: ReturnType<typeof setInterval> | null = null

export const useCleanupStore = create<CleanupStoreState>((set, get) => ({
  status: { queued: 0, processing: 0, failed: 0, total: 0 },
  polling: false,
  error: null,

  fetchStatus: async () => {
    try {
      const status = await window.api.cleanup.status()
      set({ status: (status as CleanupStatus) ?? { queued: 0, processing: 0, failed: 0, total: 0 }, error: null })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  startPolling: (intervalMs = 3000) => {
    if (pollingTimer) return
    set({ polling: true })
    get().fetchStatus()
    pollingTimer = setInterval(() => {
      get().fetchStatus()
    }, intervalMs)
  },

  stopPolling: () => {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
    set({ polling: false })
  },

  retryFailed: async () => {
    try {
      await window.api.cleanup.retryFailed()
      await get().fetchStatus()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  clearFailed: async () => {
    try {
      await window.api.cleanup.clearFailed()
      await get().fetchStatus()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },
}))
