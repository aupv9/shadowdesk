import { create } from 'zustand'
import type { License, LicensePlan } from '../types'

interface LicenseStore {
  license: License | null
  usage: { profiles: number; members: number }
  loading: boolean
  error: string | null

  fetchLicense:      () => Promise<void>
  activateLicense:   (key: string) => Promise<void>
  deactivateLicense: () => Promise<void>
  fetchUsage:        () => Promise<void>
  checkProfileLimit: () => Promise<{ allowed: boolean; current: number; max: number }>
}

export const useLicenseStore = create<LicenseStore>((set) => ({
  license: null,
  usage: { profiles: 0, members: 0 },
  loading: false,
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
