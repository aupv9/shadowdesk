import { create } from 'zustand'
import type { License, LicensePlan } from '../types'

interface LicenseStore {
  license: License | null
  usage: { profiles: number; members: number }
  loading: boolean
  refreshing: boolean
  lastRefreshedAt: number | null
  error: string | null

  fetchLicense:      () => Promise<void>
  refreshLicense:    () => Promise<void>
  activateLicense:   (key: string) => Promise<void>
  deactivateLicense: () => Promise<void>
  fetchUsage:        () => Promise<void>
  checkProfileLimit: () => Promise<{ allowed: boolean; current: number; max: number }>
}

export const useLicenseStore = create<LicenseStore>((set) => ({
  license: null,
  usage: { profiles: 0, members: 0 },
  loading: false,
  refreshing: false,
  lastRefreshedAt: null,
  error: null,

  fetchLicense: async () => {
    set({ loading: true, error: null })
    try {
      const license = await window.api.license.current()
      set({ license, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  // Force a roundtrip to the licensing server to pick up plan upgrades,
  // renewals, or revocations. Falls back silently on network failure so the
  // cached license remains usable offline.
  refreshLicense: async () => {
    set({ refreshing: true, error: null })
    try {
      const license = await window.api.license.fetch()
      set({ license, refreshing: false, lastRefreshedAt: Date.now() })
    } catch (e: any) {
      set({ error: e.message, refreshing: false })
    }
  },

  activateLicense: async (key) => {
    set({ loading: true, error: null })
    try {
      const license = await window.api.license.activate(key)
      set({ license, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    }
  },

  deactivateLicense: async () => {
    await window.api.license.deactivate()
    set({ license: null })
  },

  fetchUsage: async () => {
    const usage = await window.api.license.usage()
    set({ usage })
  },

  checkProfileLimit: async () => {
    return window.api.license.checkProfileLimit()
  }
}))
