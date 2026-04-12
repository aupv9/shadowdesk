import { create } from 'zustand'
import type { FeatureFlag, RemoteConfig, Announcement } from '../types'

interface RemoteConfigState {
  config: RemoteConfig | null
  flags: FeatureFlag[]
  announcements: Announcement[]
  loading: boolean
  error: string | null
  versionOk: boolean | null

  fetchConfig: () => Promise<void>
  fetchFlags: () => Promise<void>
  fetchAnnouncements: () => Promise<void>
  isEnabled: (key: string) => Promise<boolean>
  getFlag: (key: string) => Promise<FeatureFlag | null>
  getSetting: <T = unknown>(key: string) => Promise<T | null>
  dismissAnnouncement: (id: string) => Promise<void>
  checkVersion: () => Promise<{ ok: boolean; minimum: string | null; current: string }>
}

export const useRemoteConfigStore = create<RemoteConfigState>((set) => ({
  config: null,
  flags: [],
  announcements: [],
  loading: false,
  error: null,
  versionOk: null,

  fetchConfig: async () => {
    set({ loading: true, error: null })
    try {
      const config = await window.api.remoteConfig.fetch()
      set({
        config,
        flags: config.flags,
        announcements: config.announcements,
        loading: false
      })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  fetchFlags: async () => {
    try {
      const flags = await window.api.remoteConfig.flags()
      set({ flags })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  fetchAnnouncements: async () => {
    try {
      const announcements = await window.api.remoteConfig.announcements()
      set({ announcements })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  isEnabled: async (key: string) => {
    return window.api.remoteConfig.isEnabled(key)
  },

  getFlag: async (key: string) => {
    return window.api.remoteConfig.flag(key)
  },

  getSetting: async <T = unknown>(key: string) => {
    return window.api.remoteConfig.setting(key) as Promise<T | null>
  },

  dismissAnnouncement: async (id: string) => {
    await window.api.remoteConfig.dismissAnnouncement(id)
    set((state) => ({
      announcements: state.announcements.filter((a) => a.id !== id)
    }))
  },

  checkVersion: async () => {
    const result = await window.api.remoteConfig.checkVersion()
    set({ versionOk: result.ok })
    return result
  }
}))
