import { create } from 'zustand'
import type { ApiKeyInfo } from '../types'

interface ApiKeyStore {
  keys: ApiKeyInfo[]
  loading: boolean
  error: string | null

  fetchKeys:   (userId: string) => Promise<void>
  createKey:   (userId: string, input: { name: string; scopes: string[]; expires_in?: number }) => Promise<ApiKeyInfo>
  rotateKey:   (keyId: string) => Promise<ApiKeyInfo>
  deleteKey:   (keyId: string) => Promise<void>
}

export const useApiKeyStore = create<ApiKeyStore>((set, get) => ({
  keys: [],
  loading: false,
  error: null,

  fetchKeys: async (userId) => {
    set({ loading: true, error: null })
    try {
      const keys = await window.api.apiKeys.list(userId)
      set({ keys, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  createKey: async (userId, input) => {
    set({ loading: true, error: null })
    try {
      const key = await window.api.apiKeys.create(userId, input)
      set({ keys: [...get().keys, key], loading: false })
      return key
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    }
  },

  rotateKey: async (keyId) => {
    set({ loading: true, error: null })
    try {
      const rotated = await window.api.apiKeys.rotate(keyId)
      set({
        keys: get().keys.map((k) => (k.id === keyId ? rotated : k)),
        loading: false
      })
      return rotated
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    }
  },

  deleteKey: async (keyId) => {
    set({ loading: true, error: null })
    try {
      await window.api.apiKeys.delete(keyId)
      set({
        keys: get().keys.filter((k) => k.id !== keyId),
        loading: false
      })
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    }
  }
}))
