import { create } from 'zustand'
import type {
  HardenerFix,
  LiveAdjustmentEvent,
  PreFlightValidationResult
} from '../types'

/**
 * Phase 17.H — Platform-Specific Detection Hardening store
 *
 * Holds the latest pre-flight validator result + any live-adjustment
 * events emitted during a running workflow, and exposes a helper to
 * apply a HardenerFix via the IPC bridge.
 */
interface HardenerState {
  preFlight: PreFlightValidationResult | null
  liveAdjustment: LiveAdjustmentEvent | null
  applying: boolean
  error: string | null

  validate: (workflowId: string, profileId: string) => Promise<PreFlightValidationResult>
  setPreFlight: (result: PreFlightValidationResult | null) => void
  setLiveAdjustment: (event: LiveAdjustmentEvent | null) => void
  applyFix: (profileId: string, fix: HardenerFix) => Promise<void>
  dismiss: () => void
  clearError: () => void
}

export const useHardenerStore = create<HardenerState>((set) => ({
  preFlight: null,
  liveAdjustment: null,
  applying: false,
  error: null,

  validate: async (workflowId, profileId) => {
    try {
      const result = (await window.api.hardener.validate(workflowId, profileId)) as PreFlightValidationResult
      set({ preFlight: result, error: null })
      return result
    } catch (err: any) {
      set({ error: err?.message ?? 'Pre-flight validation failed' })
      throw err
    }
  },

  setPreFlight: (result) => set({ preFlight: result }),
  setLiveAdjustment: (event) => set({ liveAdjustment: event }),

  applyFix: async (profileId, fix) => {
    set({ applying: true, error: null })
    try {
      await window.api.hardener.applyFix(profileId, fix)
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to apply fix' })
      throw err
    } finally {
      set({ applying: false })
    }
  },

  dismiss: () => set({ preFlight: null, liveAdjustment: null }),
  clearError: () => set({ error: null })
}))
