import { create } from 'zustand'
import type { MarketplaceWorkflow, MarketplaceCategory } from '../types'

interface MarketplaceStore {
  items: MarketplaceWorkflow[]
  loading: boolean
  error: string | null
  installedIds: Set<string>
  fetch: (opts?: { category?: MarketplaceCategory; q?: string }) => Promise<void>
  install: (id: string, customName?: string) => Promise<void>
}

export const useMarketplaceStore = create<MarketplaceStore>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  installedIds: new Set(),

  fetch: async (opts) => {
    set({ loading: true, error: null })
    try {
      const items = await window.api.marketplace.list(opts)
      set({ items, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  install: async (id, customName) => {
    await window.api.marketplace.install(id, customName)
    set((s) => ({ installedIds: new Set([...s.installedIds, id]) }))
  }
}))
