import { create } from 'zustand'
import type { ProxyConfig, CreateProxyInput, UpdateProxyInput } from '../types'

interface ProxyState {
  proxies: ProxyConfig[]
  testing: Set<string>
  loading: boolean

  fetchProxies: () => Promise<void>
  createProxy: (input: CreateProxyInput) => Promise<void>
  updateProxy: (id: string, patch: UpdateProxyInput) => Promise<void>
  deleteProxy: (id: string) => Promise<void>
  deleteProxies: (ids: string[]) => Promise<void>
  testProxy: (id: string) => Promise<{ latency_ms: number; healthy: boolean }>
  testProxies: (ids: string[]) => Promise<void>
}

export const useProxyStore = create<ProxyState>((set, get) => ({
  proxies: [],
  testing: new Set(),
  loading: false,

  fetchProxies: async () => {
    set({ loading: true })
    try {
      const proxies = await window.api.proxies.list()
      set({ proxies, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  createProxy: async (input: CreateProxyInput) => {
    const proxy = await window.api.proxies.create(input)
    set((s) => ({ proxies: [proxy as ProxyConfig, ...s.proxies] }))
  },

  updateProxy: async (id: string, patch: UpdateProxyInput) => {
    const updated = (await window.api.proxies.update(id, patch)) as ProxyConfig
    set((s) => ({
      proxies: s.proxies.map((p) => (p.id === id ? { ...p, ...updated } : p)),
    }))
  },

  deleteProxy: async (id: string) => {
    await window.api.proxies.delete(id)
    set((s) => ({ proxies: s.proxies.filter((p) => p.id !== id) }))
  },

  deleteProxies: async (ids: string[]) => {
    await Promise.all(ids.map((id) => window.api.proxies.delete(id)))
    const idSet = new Set(ids)
    set((s) => ({ proxies: s.proxies.filter((p) => !idSet.has(p.id)) }))
  },

  testProxy: async (id: string) => {
    set((s) => ({ testing: new Set([...s.testing, id]) }))
    try {
      const result = await window.api.proxies.test(id)
      // Update health in list
      set((s) => ({
        proxies: s.proxies.map((p) =>
          p.id === id ? { ...p, is_healthy: result.healthy, latency_ms: result.latency_ms, last_checked_at: new Date().toISOString() } as any : p
        ),
        testing: new Set([...s.testing].filter((x) => x !== id))
      }))
      return result
    } catch (e) {
      set((s) => ({ testing: new Set([...s.testing].filter((x) => x !== id)) }))
      throw e
    }
  },

  /**
   * Test many proxies concurrently (bounded parallelism). Individual failures
   * are caught so a single bad proxy doesn't abort the batch.
   */
  testProxies: async (ids: string[]) => {
    if (ids.length === 0) return
    const testOne = get().testProxy
    const CONCURRENCY = 5
    let idx = 0
    const runWorker = async () => {
      while (idx < ids.length) {
        const current = ids[idx++]
        try { await testOne(current) } catch { /* swallowed — UI reflects health */ }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => runWorker())
    )
  },
}))
