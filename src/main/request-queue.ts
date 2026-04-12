import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { apiRequest } from './api-client'
import { isAuthenticated } from './auth'

/**
 * Offline Request Queue
 *
 * Persists failed API requests to disk and replays them when the
 * connection to the Common SaaS backend is restored. Used for
 * audit log entries, profile sync events, and other non-critical
 * fire-and-forget operations.
 *
 * Critical flows (auth, license, sync push/pull) should NOT use this
 * queue — they have their own retry logic and must surface errors
 * immediately.
 */

interface QueuedRequest {
  id: string
  path: string
  method: string
  body?: unknown
  created_at: string
  retries: number
}

const MAX_QUEUE_SIZE = 500
const MAX_RETRIES = 5
const REPLAY_INTERVAL_MS = 30_000 // 30 seconds

let queue: QueuedRequest[] = []
let replayTimer: ReturnType<typeof setInterval> | null = null
let online = true

function queueFilePath(): string {
  const dir = join(app.getPath('userData'), 'queue')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'offline-requests.json')
}

function persistQueue(): void {
  try {
    writeFileSync(queueFilePath(), JSON.stringify(queue, null, 2))
  } catch {
    // Disk write failure is non-fatal.
  }
}

function loadQueue(): void {
  try {
    const p = queueFilePath()
    if (existsSync(p)) {
      const raw = readFileSync(p, 'utf-8')
      if (raw.trim()) {
        queue = JSON.parse(raw)
      }
    }
  } catch {
    queue = []
  }
}

/**
 * Add a request to the offline queue.
 * Returns the queue entry id.
 */
export function enqueue(path: string, method: string, body?: unknown): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  if (queue.length >= MAX_QUEUE_SIZE) {
    // Drop oldest entries to prevent unbounded growth
    queue.splice(0, queue.length - MAX_QUEUE_SIZE + 1)
  }
  queue.push({
    id,
    path,
    method,
    body,
    created_at: new Date().toISOString(),
    retries: 0
  })
  persistQueue()
  return id
}

/**
 * Attempt to replay all queued requests.
 * Successfully replayed entries are removed; failed entries have their
 * retry count incremented and remain in the queue.
 */
async function replayQueue(): Promise<void> {
  if (!isAuthenticated() || queue.length === 0) return

  const toReplay = [...queue]
  const completed: string[] = []
  const expired: string[] = []

  for (const entry of toReplay) {
    if (entry.retries >= MAX_RETRIES) {
      expired.push(entry.id)
      continue
    }

    try {
      await apiRequest(entry.path, {
        method: entry.method,
        body: entry.body
      })
      completed.push(entry.id)
    } catch {
      entry.retries++
      // Still in queue — will be retried next cycle
    }
  }

  // Remove completed and expired entries
  const removeSet = new Set([...completed, ...expired])
  queue = queue.filter((e) => !removeSet.has(e.id))
  persistQueue()

  if (completed.length > 0 || expired.length > 0) {
    online = true
  }
}

/**
 * Start the background replay timer.
 * Called once at app startup.
 */
export function startReplayWorker(): void {
  loadQueue()
  stopReplayWorker()
  replayTimer = setInterval(replayQueue, REPLAY_INTERVAL_MS)
  // Immediate first attempt
  replayQueue()
}

/**
 * Stop the background replay timer.
 * Called on app quit.
 */
export function stopReplayWorker(): void {
  if (replayTimer) {
    clearInterval(replayTimer)
    replayTimer = null
  }
}

/**
 * Mark the connection as offline (e.g. after a network error in apiRequest).
 */
export function markOffline(): void {
  online = false
}

/**
 * Check if we believe the API is reachable.
 */
export function isOnline(): boolean {
  return online
}

/**
 * Get current queue depth (for renderer status display).
 */
export function getQueueDepth(): number {
  return queue.length
}

/**
 * Force an immediate replay attempt.
 */
export async function forceReplay(): Promise<{ replayed: number; remaining: number }> {
  const before = queue.length
  await replayQueue()
  return { replayed: before - queue.length, remaining: queue.length }
}
