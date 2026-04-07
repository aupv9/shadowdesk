import { create } from 'zustand'
import type { License, LicenseDevice, LicensePlan } from '../types'

export interface LicenseStatusInfo {
  status: 'active' | 'grace' | 'expired' | 'free'
  days_until_expiry: number
  in_grace_period: boolean
}

interface LicenseStore {
  license: License | null
  status: LicenseStatusInfo | null
  usage: { profiles: number; members: number }
  // E1: device dashboard
  devices: LicenseDevice[]
  devicesLoaded: boolean
  devicesLoading: boolean
  loading: boolean
  refreshing: boolean
  lastRefreshedAt: number | null
  error: string | null

  fetchLicense:      () => Promise<void>
  refreshLicense:    () => Promise<void>
  fetchStatus:       () => Promise<void>
  activateLicense:   (key: string) => Promise<void>
  deactivateLicense: () => Promise<void>
  fetchUsage:        () => Promise<void>
  fetchDevices:      () => Promise<void>
  deactivateDevice:  (machineId: string) => Promise<void>
  checkProfileLimit: () => Promise<{ allowed: boolean; current: number; max: number }>
}

export const useLicenseStore = create<LicenseStore>((set, get) => ({
  license: null,
  status: null,
  usage: { profiles: 0, members: 0 },
  devices: [],
  devicesLoaded: false,
  devicesLoading: false,
  loading: false,
  refreshing: false,
  lastRefreshedAt: null,
  error: null,

  fetchLicense: async () => {
    set({ loading: true, error: null })
    try {
      const [license, status] = await Promise.all([
        window.api.license.current(),
        window.api.license.status()
      ])
      set({ license, status, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchStatus: async () => {
    try {
      const status = await window.api.license.status()
      set({ status })
    } catch { /* ignore */ }
  },

  // Force a roundtrip to the licensing server to pick up plan upgrades,
  // renewals, or revocations. Falls back silently on network failure so the
  // cached license remains usable offline.
  refreshLicense: async () => {
    set({ refreshing: true, error: null })
    try {
      const license = await window.api.license.fetch()
      const status = await window.api.license.status()
      set({ license, status, refreshing: false, lastRefreshedAt: Date.now() })
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

  // E1: load the list of machines this license is activated on. Returns
  // an empty array silently if the backend doesn't yet implement the
  // endpoint, so the renderer can fall back to "no data".
  fetchDevices: async () => {
    set({ devicesLoading: true })
    try {
      const devices = await window.api.license.devices()
      set({ devices, devicesLoaded: true, devicesLoading: false })
    } catch {
      set({ devices: [], devicesLoaded: true, devicesLoading: false })
    }
  },

  // E1: revoke a remote machine's seat. Refreshes the device list and
  // bumps the license cache so the seats_used counter ticks down.
  deactivateDevice: async (machineId) => {
    await window.api.license.deactivateDevice(machineId)
    // Drop the deactivated row optimistically before refetching
    set({ devices: get().devices.filter((d) => d.machine_id !== machineId) })
    try {
      const [devices, license] = await Promise.all([
        window.api.license.devices(),
        window.api.license.fetch()
      ])
      set({ devices, license })
    } catch {
      // Best-effort refresh — leave the optimistic state.
    }
  },

  checkProfileLimit: async () => {
    return window.api.license.checkProfileLimit()
  }
}))
