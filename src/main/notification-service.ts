import { BrowserWindow } from 'electron'
import { apiRequest } from './api-client'
import { isAuthenticated } from './auth'

/**
 * Common SaaS Notification Service
 * Endpoints: /api/v1/notifications
 *
 * Polls for server-side notifications (license expiry, team invites,
 * detection alerts, system announcements) and forwards them to the
 * renderer via IPC.
 */

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

let pollTimer: ReturnType<typeof setInterval> | null = null
let mainWindow: BrowserWindow | null = null
const POLL_INTERVAL_MS = 60_000 // 1 minute

/** Fetch all notifications for the authenticated user. */
export async function listNotifications(params?: {
  page?: number
  limit?: number
  unread_only?: boolean
}): Promise<{ notifications: AppNotification[]; total: number; unread_count: number }> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.unread_only) query.set('unread_only', 'true')
  const qs = query.toString()

  try {
    return await apiRequest(`/notifications${qs ? `?${qs}` : ''}`)
  } catch {
    return { notifications: [], total: 0, unread_count: 0 }
  }
}

/** Mark a single notification as read. */
export async function markAsRead(notificationId: string): Promise<void> {
  await apiRequest(`/notifications/${notificationId}/read`, { method: 'POST' })
}

/** Mark all notifications as read. */
export async function markAllAsRead(): Promise<void> {
  await apiRequest('/notifications/read-all', { method: 'POST' })
}

/** Delete a notification. */
export async function deleteNotification(notificationId: string): Promise<void> {
  await apiRequest(`/notifications/${notificationId}`, { method: 'DELETE' })
}

// ── Background Polling ──────────────────────────────────────────────────────

function notifyRenderer(unreadCount: number, notifications: AppNotification[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('notifications:update', { unread_count: unreadCount, notifications })
  }
}

async function pollOnce(): Promise<void> {
  if (!isAuthenticated()) return
  try {
    const res = await listNotifications({ limit: 20, unread_only: true })
    notifyRenderer(res.unread_count, res.notifications)
  } catch {
    // Polling failure is non-fatal — will retry on next interval.
  }
}

export function startNotificationPolling(window: BrowserWindow): void {
  mainWindow = window
  stopNotificationPolling()
  // Initial fetch on startup
  pollOnce()
  pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS)
}

export function stopNotificationPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
