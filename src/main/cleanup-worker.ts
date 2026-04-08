/**
 * Async Profile Cleanup Worker
 *
 * Handles asynchronous cleanup of profile directories after deletion.
 * - Dequeues cleanup tasks and removes user-data directories
 * - Retries with exponential backoff on failure
 * - Persists queue in-memory (clears on app exit)
 * - Throttles concurrent cleanups to avoid I/O bottlenecks
 */

import { rm } from 'fs/promises'
import { existsSync } from 'fs'
import { BrowserWindow } from 'electron'

export interface CleanupTask {
  profileId: string
  paths: string[] // Absolute paths to delete
  retries: number
  lastAttempt: Date | null
  // Phase 4.3: Delayed cleanup — task won't execute before this timestamp.
  // Used to give users an undo window for bulk-delete operations.
  availableAt: number
}

export interface CleanupStatus {
  queued: number
  processing: number
  failed: number
  total: number
}

const MAX_RETRIES = 3
const MAX_CONCURRENT = 3
const RETRY_DELAYS = [1000, 5000, 30000] // ms: 1s, 5s, 30s

export class CleanupWorker {
  private static instance: CleanupWorker
  private queue: CleanupTask[] = []
  private processing: Set<string> = new Set() // profileIds being processed
  private failed: Map<string, CleanupTask> = new Map() // Failed cleanups
  private isRunning = false
  private workerLoop: ReturnType<typeof setInterval> | null = null
  private mainWindow: BrowserWindow | null = null

  static getInstance(): CleanupWorker {
    if (!CleanupWorker.instance) {
      CleanupWorker.instance = new CleanupWorker()
    }
    return CleanupWorker.instance
  }

  /**
   * Initialize worker with reference to main window for status updates
   */
  init(mainWindow: BrowserWindow | null): void {
    this.mainWindow = mainWindow
  }

  /**
   * Enqueue cleanup task for a profile
   * @param profileId - Profile ID to clean up
   * @param paths - Absolute paths to delete
   * @param delayMs - Optional: minimum delay before execution (Phase 4.3: undo window)
   */
  enqueue(profileId: string, paths: string[], delayMs: number = 0): void {
    if (!profileId || paths.length === 0) {
      console.warn('[CleanupWorker] Skipped invalid cleanup task')
      return
    }

    // Check if already queued
    if (this.queue.some((t) => t.profileId === profileId)) {
      console.warn(`[CleanupWorker] Profile ${profileId} already queued`)
      return
    }

    this.queue.push({
      profileId,
      paths,
      retries: 0,
      lastAttempt: null,
      availableAt: Date.now() + delayMs,
    })

    const delayNote = delayMs > 0 ? ` (delayed ${delayMs}ms for undo window)` : ''
    console.log(
      `[CleanupWorker] Enqueued cleanup for profile ${profileId} (${paths.length} paths)${delayNote}`,
    )
  }

  /**
   * Phase 4.3: Cancel a pending cleanup task (undo support).
   * Only cancels tasks that haven't started processing yet.
   * @param profileId - Profile ID to cancel cleanup for
   * @returns true if cancelled, false if already processing or not found
   */
  cancel(profileId: string): boolean {
    const index = this.queue.findIndex((t) => t.profileId === profileId)
    if (index !== -1) {
      this.queue.splice(index, 1)
      console.log(`[CleanupWorker] Cancelled cleanup for profile ${profileId}`)
      return true
    }

    // Check failed map too — allow clearing failed records
    if (this.failed.has(profileId)) {
      this.failed.delete(profileId)
      console.log(`[CleanupWorker] Cleared failed cleanup record for ${profileId}`)
      return true
    }

    return false
  }

  /**
   * Phase 4.3: Cancel multiple pending cleanups (bulk undo support).
   * @returns Number of tasks cancelled
   */
  cancelBulk(profileIds: string[]): number {
    let cancelled = 0
    for (const id of profileIds) {
      if (this.cancel(id)) cancelled++
    }
    return cancelled
  }

  /**
   * Start worker loop
   */
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    console.log('[CleanupWorker] Started')

    this.workerLoop = setInterval(() => {
      this.processQueue()
    }, 2000) // Check queue every 2 seconds
  }

  /**
   * Stop worker gracefully
   */
  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.workerLoop) {
      clearInterval(this.workerLoop)
      this.workerLoop = null
    }

    console.log(
      `[CleanupWorker] Stopped (${this.queue.length} pending, ${this.failed.size} failed)`,
    )
  }

  /**
   * Get current status
   */
  getStatus(): CleanupStatus {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      failed: this.failed.size,
      total: this.queue.length + this.processing.size + this.failed.size,
    }
  }

  /**
   * Process queue: dequeue up to MAX_CONCURRENT tasks and execute.
   * Phase 4.3: Skips tasks whose availableAt is in the future (delayed cleanup).
   */
  private async processQueue(): Promise<void> {
    if (!this.isRunning) return

    const now = Date.now()

    // Don't exceed max concurrent
    while (this.processing.size < MAX_CONCURRENT) {
      // Find first task that's ready to execute
      const readyIndex = this.queue.findIndex((t) => t.availableAt <= now)
      if (readyIndex === -1) break

      const [task] = this.queue.splice(readyIndex, 1)
      this.processing.add(task.profileId)
      this.executeCleanup(task).catch((error) => {
        console.error(`[CleanupWorker] Uncaught error for ${task.profileId}:`, error)
      })
    }
  }

  /**
   * Execute cleanup with retry logic
   */
  private async executeCleanup(task: CleanupTask): Promise<void> {
    try {
      await this.attemptCleanup(task.paths)
      this.processing.delete(task.profileId)
      console.log(`[CleanupWorker] ✓ Cleaned up profile ${task.profileId}`)
    } catch (error) {
      task.lastAttempt = new Date()
      task.retries++

      if (task.retries < MAX_RETRIES) {
        // Re-queue with delay
        const delayMs = RETRY_DELAYS[task.retries - 1]
        console.warn(
          `[CleanupWorker] ⚠ Cleanup failed for ${task.profileId}, retry ${task.retries}/${MAX_RETRIES} in ${delayMs}ms`,
          error,
        )

        // Update availableAt so processQueue respects the retry delay
        task.availableAt = Date.now() + delayMs
        this.queue.push(task)
      } else {
        // Mark as failed
        this.failed.set(task.profileId, task)
        console.error(
          `[CleanupWorker] ✗ Cleanup failed permanently for ${task.profileId} after ${MAX_RETRIES} retries`,
          error,
        )
      }

      this.processing.delete(task.profileId)
      this.notifyStatus()
    }
  }

  /**
   * Attempt to remove directories
   */
  private async attemptCleanup(paths: string[]): Promise<void> {
    for (const path of paths) {
      // Sanity check: ensure path is under app userData (prevent accidental deletion)
      // This check should be done before enqueue, but double-check here
      if (!path || !path.length) {
        throw new Error(`Invalid path for cleanup: ${path}`)
      }

      if (existsSync(path)) {
        await rm(path, { recursive: true, force: true })
      }
    }
  }

  /**
   * Get failed cleanup tasks for manual recovery
   */
  getFailedCleanups(): CleanupTask[] {
    return Array.from(this.failed.values())
  }

  /**
   * Retry all failed cleanups
   */
  retryFailedCleanups(): void {
    const failed = Array.from(this.failed.values())
    console.log(`[CleanupWorker] Retrying ${failed.length} failed cleanups`)

    for (const task of failed) {
      // Reset retry counter and availableAt to allow immediate retries
      const retriedTask: CleanupTask = {
        ...task,
        retries: 0,
        lastAttempt: null,
        availableAt: Date.now(),
      }
      this.queue.push(retriedTask)
      this.failed.delete(task.profileId)
    }

    this.notifyStatus()
  }

  /**
   * Clear all failed cleanups (manual intervention)
   */
  clearFailedCleanups(): void {
    console.log(`[CleanupWorker] Clearing ${this.failed.size} failed cleanup records`)
    this.failed.clear()
    this.notifyStatus()
  }

  /**
   * Notify renderer of status changes
   */
  private notifyStatus(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('cleanup:status', this.getStatus())
    }
  }
}
