import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'

/**
 * Offline Queue System
 *
 * Queues requests when the server is unavailable and retries them when online.
 * Useful for:
 * - Creating profiles while offline
 * - Starting workflows when connection is lost
 * - Creating detection tests without network
 *
 * Queue persists to disk so requests survive app restarts.
 */

export interface QueuedRequest {
  id: string
  method: string
  path: string
  body?: unknown
  timestamp: number
  retries: number
  maxRetries: number
}

export interface QueueState {
  requests: QueuedRequest[]
  lastSyncAt: number | null
  isOnline: boolean
}

class OfflineQueue {
  private state: QueueState = {
    requests: [],
    lastSyncAt: null,
    isOnline: true
  }
  private queuePath = join(app.getPath('userData'), 'offline-queue.json')
  private isProcessing = false

  constructor() {
    this.loadFromDisk()
  }

  // ── File Persistence ──────────────────────────────────────────────────────

  private loadFromDisk(): void {
    try {
      if (existsSync(this.queuePath)) {
        const data = JSON.parse(readFileSync(this.queuePath, 'utf-8'))
        this.state = data
      }
    } catch (e) {
      console.error('Failed to load offline queue:', e)
      this.state = { requests: [], lastSyncAt: null, isOnline: true }
    }
  }

  private saveToDisk(): void {
    try {
      writeFileSync(this.queuePath, JSON.stringify(this.state, null, 2))
    } catch (e) {
      console.error('Failed to save offline queue:', e)
    }
  }

  // ── Queue Management ──────────────────────────────────────────────────────

  public addRequest(method: string, path: string, body?: unknown): string {
    const id = uuidv4()
    const request: QueuedRequest = {
      id,
      method,
      path,
      body,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3
    }

    this.state.requests.push(request)
    this.saveToDisk()

    console.log(`[OfflineQueue] Added request ${id}: ${method} ${path}`)
    return id
  }

  public removeRequest(id: string): void {
    this.state.requests = this.state.requests.filter((r) => r.id !== id)
    this.saveToDisk()
  }

  public getQueuedRequests(): QueuedRequest[] {
    return [...this.state.requests]
  }

  public getQueueSize(): number {
    return this.state.requests.length
  }

  // ── Online/Offline Status ─────────────────────────────────────────────────

  public setOnline(online: boolean): void {
    this.state.isOnline = online

    if (online) {
      console.log('[OfflineQueue] Back online - syncing queued requests')
      this.syncQueue()
    } else {
      console.log('[OfflineQueue] Went offline - requests will be queued')
    }
  }

  public isOnline(): boolean {
    return this.state.isOnline
  }

  // ── Queue Processing ─────────────────────────────────────────────────────

  /**
   * Sync queued requests to server.
   * Called automatically when going online, or manually by user.
   */
  public async syncQueue(): Promise<{ succeeded: number; failed: number }> {
    if (this.isProcessing) {
      console.log('[OfflineQueue] Sync already in progress')
      return { succeeded: 0, failed: 0 }
    }

    this.isProcessing = true
    let succeeded = 0
    let failed = 0

    console.log(`[OfflineQueue] Starting sync of ${this.state.requests.length} requests`)

    // Process requests in order (FIFO)
    while (this.state.requests.length > 0) {
      const request = this.state.requests[0]

      try {
        // Import here to avoid circular dependency
        const { apiRequest } = await import('./api-client')

        await apiRequest(request.path, {
          method: request.method,
          body: request.body,
          authenticated: true
        })

        // Success - remove from queue
        this.removeRequest(request.id)
        succeeded++
        console.log(`[OfflineQueue] ✓ Synced ${request.method} ${request.path}`)
      } catch (error: any) {
        request.retries++

        // Check if we should retry
        if (request.retries >= request.maxRetries) {
          console.error(`[OfflineQueue] ✗ Failed after ${request.maxRetries} retries: ${request.method} ${request.path}`)
          this.removeRequest(request.id)
          failed++
        } else {
          console.warn(`[OfflineQueue] Retry ${request.retries}/${request.maxRetries}: ${request.method} ${request.path}`)
          this.saveToDisk()
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000 * request.retries))
        }
      }
    }

    this.state.lastSyncAt = Date.now()
    this.saveToDisk()
    this.isProcessing = false

    console.log(`[OfflineQueue] Sync complete: ${succeeded} succeeded, ${failed} failed`)
    return { succeeded, failed }
  }

  /**
   * Clear all queued requests.
   * Use with caution - this discards unsent data!
   */
  public clearQueue(): void {
    const count = this.state.requests.length
    this.state.requests = []
    this.saveToDisk()
    console.log(`[OfflineQueue] Cleared ${count} requests`)
  }

  // ── Statistics ────────────────────────────────────────────────────────────

  public getStats() {
    return {
      queueSize: this.state.requests.length,
      isOnline: this.state.isOnline,
      lastSyncAt: this.state.lastSyncAt,
      oldestRequestAge: this.state.requests.length > 0 ? Date.now() - this.state.requests[0].timestamp : 0
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ════════════════════════════════════════════════════════════════════════════

let instance: OfflineQueue | null = null

export function getOfflineQueue(): OfflineQueue {
  if (!instance) {
    instance = new OfflineQueue()
  }
  return instance
}

/**
 * Wrapper function to conditionally queue or send requests.
 * Use this in place of apiRequest() when offline support is needed.
 */
export async function apiRequestWithOfflineSupport<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const queue = getOfflineQueue()
  const { method = 'GET', body } = options

  try {
    // Try to make the request
    const { apiRequest } = await import('./api-client')
    return await apiRequest<T>(path, { method, body, authenticated: true })
  } catch (error: any) {
    // If offline and it's a state-changing request, queue it
    if (!queue.isOnline() && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
      console.log(`[OfflineQueue] Request failed - queueing: ${method} ${path}`)
      queue.addRequest(method, path, body)
      // Return a pending response
      return { _queued: true, _requestId: queue.getQueuedRequests()[queue.getQueuedRequests().length - 1].id } as T
    }

    // Otherwise rethrow
    throw error
  }
}
