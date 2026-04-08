import { create } from 'zustand'
import type {
  ProxyProviderAccountView,
  ProxyProviderCatalogEntry,
  ProxyProviderCredentialsInput,
  ProxyProviderTestResult,
  ProxyProviderType,
  ProxyGenerationOptions,
  ProxyPoolType,
  ProxySessionType,
} from '../types'

/**
 * Phase 20 — Proxy Provider Marketplace store
 * (UI label: "Phase 17 — Proxy API Integration")
 */
interface ProxyProviderState {
  catalog: ProxyProviderCatalogEntry[]
  accounts: ProxyProviderAccountView[]
  loading: boolean
  testing: Set<string>
  generating: Set<string>

  fetchCatalog: () => Promise<void>
  fetchAccounts: () => Promise<void>
  createAccount: (input: {
    type: ProxyProviderType
    label: string
    endpoint?: string
    port?: number
    defaultPool?: ProxyPoolType
    defaultSession?: ProxySessionType
    credentials: ProxyProviderCredentialsInput
  }) => Promise<ProxyProviderAccountView>
  updateAccount: (id: string, patch: any) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  testAccount: (id: string) => Promise<ProxyProviderTestResult>
  refreshUsage: (id: string) => Promise<void>
  generateAndImport: (
    id: string,
    options: ProxyGenerationOptions,
  ) => Promise<{ imported: number }>
}

export const useProxyProviderStore = create<ProxyProviderState>((set, get) => ({
  catalog: [],
  accounts: [],
  loading: false,
  testing: new Set(),
  generating: new Set(),

  fetchCatalog: async () => {
    const catalog = (await window.api.proxyProviders.catalog()) as ProxyProviderCatalogEntry[]
    set({ catalog })
  },

  fetchAccounts: async () => {
    set({ loading: true })
    try {
      const accounts = (await window.api.proxyProviders.list()) as ProxyProviderAccountView[]
      set({ accounts, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  createAccount: async (input) => {
    const account = (await window.api.proxyProviders.create(input)) as ProxyProviderAccountView
    set((s) => ({ accounts: [account, ...s.accounts] }))
    return account
  },

  updateAccount: async (id, patch) => {
    const updated = (await window.api.proxyProviders.update(id, patch)) as ProxyProviderAccountView
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? updated : a)) }))
  },

  deleteAccount: async (id) => {
    await window.api.proxyProviders.delete(id)
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }))
  },

  testAccount: async (id) => {
    set((s) => ({ testing: new Set([...s.testing, id]) }))
    try {
      const result = (await window.api.proxyProviders.test(id)) as ProxyProviderTestResult
      // Refresh the account row so the new status / lastTestedAt show up.
      const accounts = (await window.api.proxyProviders.list()) as ProxyProviderAccountView[]
      set((s) => ({
        accounts,
        testing: new Set([...s.testing].filter((x) => x !== id)),
      }))
      return result
    } catch (err) {
      set((s) => ({ testing: new Set([...s.testing].filter((x) => x !== id)) }))
      throw err
    }
  },

  refreshUsage: async (id) => {
    await window.api.proxyProviders.refreshUsage(id)
    await get().fetchAccounts()
  },

  generateAndImport: async (id, options) => {
    set((s) => ({ generating: new Set([...s.generating, id]) }))
    try {
      const result = (await window.api.proxyProviders.generateAndImport(
        id,
        options,
      )) as { imported: number }
      return result
    } finally {
      set((s) => ({ generating: new Set([...s.generating].filter((x) => x !== id)) }))
    }
  },
}))
