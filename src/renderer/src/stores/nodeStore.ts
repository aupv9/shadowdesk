import { create } from 'zustand'
import type { RemoteBrowserNode, NodeHealth } from '../types'

interface NodeStore {
  nodes: RemoteBrowserNode[]
  loading: boolean
  error: string | null
  fetch:  () => Promise<void>
  add:    (input: { name: string; url: string; authToken?: string; region?: string; capacity?: number }) => Promise<void>
  remove: (id: string) => Promise<void>
  test:   (id: string) => Promise<NodeHealth>
}

export const useNodeStore = create<NodeStore>((set, get) => ({
  nodes: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const nodes = await window.api.nodes.list()
      set({ nodes, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  add: async (input) => {
    await window.api.nodes.add(input)
    await get().fetch()
  },

  remove: async (id) => {
    await window.api.nodes.remove(id)
    await get().fetch()
  },

  test: async (id) => {
    const health = await window.api.nodes.test(id)
    await get().fetch()
    return health
  }
}))
