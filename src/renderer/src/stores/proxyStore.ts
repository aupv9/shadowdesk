import { create } from 'zustand'
import type { ProxyConfig, CreateProxyInput } from '../types'

interface ProxyState {
  proxies: ProxyConfig[]
  testing: Set<string>
  loading: boolean

  fetchProxies: () => Promise<void>
  createProxy: (input: CreateProxyInput) => Promise<void>
  deleteProxy: (id: string) => Promise<void>
  testProxy: (id: string) => Promise<{ latency_ms: number; healthy: boolean }>
}

export const useProxyStore = create<ProxyState>((set) => ({
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

  deleteProxy: async (id: string) => {
    await window.api.proxies.delete(id)
    set((s) => ({ proxies: s.proxies.filter((p) => p.id !== id) }))
  },

  testProxy: async (id: string) => {
    set((s) => ({ testing: new Set([...s.testing, id]) }))
    try {
      const result = await window.api.proxies.test(id)
      // Update health in list
      set((s) => ({
        proxies: s.proxies.map((p) =>
          p.id === id ? { ...p, is_healthy: result.healthy, latency_ms: result.latency_ms } as any : p
        ),
        testing: new Set([...s.testing].filter((x) => x !== id))
      }))
      return result
    } catch (e) {
      set((s) => ({ testing: new Set([...s.testing].filter((x) => x !== id)) }))
      throw e
    }
  }
}))
