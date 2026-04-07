import { create } from 'zustand'
import type { WebhookConfig, TelegramConfig, CreateWebhookInput, WebhookEvent } from '../types'

interface WebhookStore {
  hooks: WebhookConfig[]
  telegram: TelegramConfig | null
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  fetchTelegram: () => Promise<void>
  add: (input: CreateWebhookInput) => Promise<void>
  update: (id: string, patch: Partial<WebhookConfig>) => Promise<void>
  remove: (id: string) => Promise<void>
  saveTelegram: (cfg: TelegramConfig) => Promise<void>
}

export const useWebhookStore = create<WebhookStore>((set, get) => ({
  hooks: [],
  telegram: null,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const hooks = await window.api.webhooks.list()
      set({ hooks, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchTelegram: async () => {
    const telegram = await window.api.webhooks.getTelegram()
    set({ telegram })
  },

  add: async (input) => {
    await window.api.webhooks.add(input as any)
    await get().fetch()
  },

  update: async (id, patch) => {
    await window.api.webhooks.update(id, patch as any)
    await get().fetch()
  },

  remove: async (id) => {
    await window.api.webhooks.remove(id)
    await get().fetch()
  },

  saveTelegram: async (cfg) => {
    await window.api.webhooks.saveTelegram(cfg as any)
    set({ telegram: cfg })
  }
}))
