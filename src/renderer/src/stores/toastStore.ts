import { create } from 'zustand'
import type { Toast } from '../types'

interface ToastState {
  toasts: Toast[]
  push: (message: string, type?: Toast['type'], duration?: number) => void
  // Phase 4.3: Push an actionable toast (e.g. Undo button).
  // Returns the toast ID so callers can dismiss it early.
  pushWithAction: (
    message: string,
    action: { label: string; onClick: () => void },
    type?: Toast['type'],
    duration?: number,
  ) => string
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

  pushWithAction: (message, action, type = 'info', duration = 10_000) => {
    const id = String(_nextId++)
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, type, message, action }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, duration)
    return id
  },

  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  }
}))
