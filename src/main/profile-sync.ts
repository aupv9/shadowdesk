import { apiRequest } from './api-client'
import { isAuthenticated } from './auth'
import { getCurrentLicense } from './license'

/**
 * Profile Sync Service
 *
 * Notifies the Common SaaS backend whenever browser profiles are
 * created, updated, or deleted locally. This keeps server-side
 * metadata in sync for cross-device inventory, license enforcement,
 * and team sharing — without uploading the actual fingerprint
 * (which stays local or goes through the encrypted sync flow).
 *
 * All operations are best-effort: failures are queued for retry
 * but never block the local UI.
 */

export interface ProfileSyncEvent {
  action: 'create' | 'update' | 'delete' | 'bulk_delete'
  profile_id: string
  profile_name?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

const pendingEvents: ProfileSyncEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
const FLUSH_DELAY_MS = 2_000 // batch events within 2s window

/**
 * Enqueue a profile sync event. Events are batched and flushed to the
 * backend every 2 seconds to avoid one-request-per-keystroke during
 * rapid profile edits.
 */
export function enqueueProfileSync(event: ProfileSyncEvent): void {
  pendingEvents.push(event)
  scheduleFlush()
}

function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushEvents()
  }, FLUSH_DELAY_MS)
}

async function flushEvents(): Promise<void> {
  if (pendingEvents.length === 0) return
  if (!isAuthenticated()) return

  const batch = pendingEvents.splice(0)

  try {
    await apiRequest('/sync/profile-events', {
      method: 'POST',
      body: { events: batch }
    })
  } catch {
    // Re-enqueue failed events for next flush cycle.
    // Cap at 200 to prevent unbounded memory growth.
    const requeue = batch.concat(pendingEvents.splice(0))
    pendingEvents.length = 0
    pendingEvents.push(...requeue.slice(-200))
    scheduleFlush()
  }
}

/**
 * Convenience helpers called from IPC handlers after local DB writes.
 */
export function onProfileCreated(id: string, name: string): void {
  enqueueProfileSync({
    action: 'create',
    profile_id: id,
    profile_name: name,
    timestamp: new Date().toISOString()
  })
}

export function onProfileUpdated(id: string, name?: string, changedFields?: string[]): void {
  enqueueProfileSync({
    action: 'update',
    profile_id: id,
    profile_name: name,
    timestamp: new Date().toISOString(),
    metadata: changedFields ? { changed_fields: changedFields } : undefined
  })
}

export function onProfileDeleted(id: string, name?: string): void {
  enqueueProfileSync({
    action: 'delete',
    profile_id: id,
    profile_name: name,
    timestamp: new Date().toISOString()
  })
}

export function onProfilesBulkDeleted(ids: string[]): void {
  for (const id of ids) {
    enqueueProfileSync({
      action: 'bulk_delete',
      profile_id: id,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Force-flush all pending events immediately (called on app quit).
 */
export async function flushPendingSync(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  await flushEvents()
}

/**
 * Get the current pending event count (for renderer status display).
 */
export function getPendingSyncCount(): number {
  return pendingEvents.length
}
