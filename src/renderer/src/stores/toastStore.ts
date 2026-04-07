import { create } from 'zustand'
import type { Toast } from '../types'

interface ToastState {
  toasts: Toast[]
  push: (message: string, type?: Toast['type'], duration?: number) => void
  dismiss: (id: string) => void
}

let _nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: (message, type = 'info', duration = 3500) => {
    const id = String(_nextId++)
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, type, message }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, duration)
  },

  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  }
}))
