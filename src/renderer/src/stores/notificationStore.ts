import { create } from 'zustand'

export interface AppNotification {
  id: string
  type: 'license_expiry' | 'team_invite' | 'detection_alert' | 'system' | 'billing'
  title: string
  message: string
  read: boolean
  created_at: string
  action_url?: string
  metadata?: Record<string, unknown>
}

interface NotificationStore {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  error: string | null
  unsubscribe: (() => void) | null

  fetchNotifications:  (params?: { page?: number; limit?: number; unread_only?: boolean }) => Promise<void>
  markAsRead:          (notificationId: string) => Promise<void>
  markAllAsRead:       () => Promise<void>
  deleteNotification:  (notificationId: string) => Promise<void>
  subscribe:           () => void
  cleanup:             () => void
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  unsubscribe: null,

  fetchNotifications: async (params) => {
    set({ loading: true, error: null })
    try {
      const res = await window.api.notifications.list(params)
      set({
        notifications: res.notifications,
        unreadCount: res.unread_count,
        loading: false
      })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  markAsRead: async (notificationId) => {
    try {
      await window.api.notifications.markRead(notificationId)
      set({
        notifications: get().notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, get().unreadCount - 1)
      })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  markAllAsRead: async () => {
    try {
      await window.api.notifications.markAllRead()
      set({
        notifications: get().notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0
      })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  deleteNotification: async (notificationId) => {
    try {
      await window.api.notifications.delete(notificationId)
      const wasUnread = get().notifications.find((n) => n.id === notificationId && !n.read)
      set({
        notifications: get().notifications.filter((n) => n.id !== notificationId),
        unreadCount: wasUnread ? Math.max(0, get().unreadCount - 1) : get().unreadCount
      })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  subscribe: () => {
    const unsub = window.api.notifications.onUpdate((data) => {
      set({
        notifications: data.notifications,
        unreadCount: data.unread_count
      })
    })
    set({ unsubscribe: unsub })
  },

  cleanup: () => {
    const unsub = get().unsubscribe
    if (unsub) {
      unsub()
      set({ unsubscribe: null })
    }
  }
}))
