import { create } from 'zustand'
import type { User } from '../types'

interface AuthStore {
  user: User | null
  authenticated: boolean
  loading: boolean
  error: string | null

  checkAuth:           () => Promise<void>
  login:               (email: string, password: string) => Promise<void>
  register:            (email: string, password: string, name: string) => Promise<void>
  logout:              () => Promise<void>
  updatePassword:      (current: string, newPass: string) => Promise<void>
  resendVerification:  () => Promise<void>
  exportData:          () => Promise<unknown>
  deleteAccount:       () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  authenticated: false,
  loading: true,
  error: null,

  checkAuth: async () => {
    set({ loading: true, error: null })
    try {
      const user = await window.api.auth.me()
      set({ user, authenticated: !!user, loading: false })
    } catch {
      set({ user: null, authenticated: false, loading: false })
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const user = await window.api.auth.login({ email, password })
      set({ user, authenticated: true, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    }
  },

  register: async (email, password, name) => {
    set({ loading: true, error: null })
    try {
      const user = await window.api.auth.register({ email, password, name })
      set({ user, authenticated: true, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    }
  },

  logout: async () => {
    await window.api.auth.logout()
    set({ user: null, authenticated: false })
  },

  updatePassword: async (current, newPass) => {
    await window.api.auth.updatePassword(current, newPass)
  },

  resendVerification: async () => {
    await window.api.auth.resendVerification()
  },

  exportData: async () => {
    return window.api.auth.exportData()
  },

  deleteAccount: async () => {
    await window.api.auth.deleteAccount()
    set({ user: null, authenticated: false })
  }
}))
