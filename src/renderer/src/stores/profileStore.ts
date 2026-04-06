import { create } from 'zustand'
import type { Profile, CreateProfileInput } from '../types'

interface ProfileState {
  profiles: Profile[]
  activeSessions: string[]
  loading: boolean
  error: string | null

  fetchProfiles:      ()                              => Promise<void>
  fetchActiveSessions: ()                             => Promise<void>
  createProfile:      (input: CreateProfileInput)     => Promise<void>
  updateProfile:      (id: string, data: any)         => Promise<void>
  cloneProfile:       (id: string)                    => Promise<void>
  deleteProfile:      (id: string)                    => Promise<void>
  launchProfile:      (id: string)                    => Promise<void>
  closeProfile:       (id: string)                    => Promise<void>
  rerollFingerprint:  (id: string)                    => Promise<void>
  setGroup:           (profileId: string, groupId: string | null) => Promise<void>
  exportProfile:      (id: string)                    => Promise<Buffer>
  importProfile:      (buffer: Buffer)                => Promise<void>
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  activeSessions: [],
  loading: false,
  error: null,

  fetchProfiles: async () => {
    set({ loading: true, error: null })
    try {
      const profiles = await window.api.profiles.list()
      set({ profiles: profiles.map(parseProfile), loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
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

  launchProfile: async (id: string) => {
    await window.api.profiles.launch(id)
    set((s) => ({ activeSessions: [...new Set([...s.activeSessions, id])] }))
  },

  closeProfile: async (id: string) => {
    await window.api.profiles.close(id)
    set((s) => ({ activeSessions: s.activeSessions.filter((x) => x !== id) }))
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
