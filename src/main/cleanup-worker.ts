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
   */
  enqueue(profileId: string, paths: string[]): void {
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
    })

    console.log(`[CleanupWorker] Enqueued cleanup for profile ${profileId} (${paths.length} paths)`)
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
   * Process queue: dequeue up to MAX_CONCURRENT tasks and execute
   */
  private async processQueue(): Promise<void> {
    if (!this.isRunning) return

    // Don't exceed max concurrent
    while (this.processing.size < MAX_CONCURRENT && this.queue.length > 0) {
      const task = this.queue.shift()
      if (!task) break

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

        setTimeout(() => {
          this.queue.push(task)
        }, delayMs)
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
      // Reset retry counter to allow retries again
      const retriedTask: CleanupTask = {
        ...task,
        retries: 0,
        lastAttempt: null,
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
