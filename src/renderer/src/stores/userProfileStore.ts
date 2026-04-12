import { create } from 'zustand'

export interface UserProfile {
  user_id: string
  display_name?: string
  avatar_url?: string
  bio?: string
  timezone?: string
  language?: string
  metadata?: Record<string, unknown>
  updated_at?: string
}

interface UserProfileStore {
  profile: UserProfile | null
  loading: boolean
  error: string | null

  fetchProfile:  (userId: string) => Promise<void>
  updateProfile: (userId: string, data: Partial<Pick<UserProfile, 'display_name' | 'bio' | 'timezone' | 'language'>>) => Promise<void>
  uploadAvatar:  (userId: string, imageBuffer: Buffer, filename: string) => Promise<string>
}

export const useUserProfileStore = create<UserProfileStore>((set, get) => ({
  profile: null,
  loading: false,
  error: null,

  fetchProfile: async (userId) => {
    set({ loading: true, error: null })
    try {
      const profile = await window.api.userProfile.get(userId)
      set({ profile, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  updateProfile: async (userId, data) => {
    set({ loading: true, error: null })
    try {
      const updated = await window.api.userProfile.update(userId, data)
      set({ profile: updated, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    }
  },

  uploadAvatar: async (userId, imageBuffer, filename) => {
    set({ loading: true, error: null })
    try {
      const result = await window.api.userProfile.uploadAvatar(userId, imageBuffer, filename)
      const current = get().profile
      if (current) {
        set({ profile: { ...current, avatar_url: result.avatar_url }, loading: false })
      } else {
        set({ loading: false })
      }
      return result.avatar_url
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    }
  }
}))
