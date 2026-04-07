/**
 * Phase 13.E — Structured error event system.
 *
 * Provides `emitError(webContents, category, message)` for the main process
 * to push non-fatal errors to the renderer instead of dropping them in
 * silent `catch` blocks.
 *
 * The renderer listens via `window.api.onError(handler)` and displays the
 * error through the toast notification system.
 *
 * Error categories match the subsystem:
 *   'sync'     — cloud sync push/pull failures
 *   'proxy'    — proxy test / rotation failures
 *   'browser'  — Chromium launch / page errors
 *   'captcha'  — solver provider errors
 *   'vault'    — vault idle-lock / corruption
 *   'license'  — license validation failures
 *   'general'  — uncategorised non-fatal errors
 */

import type { WebContents } from 'electron'

export type ErrorCategory =
  | 'sync'
  | 'proxy'
  | 'browser'
  | 'captcha'
  | 'vault'
  | 'license'
  | 'general'

export interface AppErrorEvent {
  category: ErrorCategory
  message: string
  timestamp: string
}

/**
 * Send a structured error event to the renderer.
 * Safe to call even if `webContents` is null, undefined, or destroyed.
 */
export function emitError(
  webContents: WebContents | null | undefined,
  category: ErrorCategory,
  message: string
): void {
  if (!webContents || webContents.isDestroyed()) return
  const event: AppErrorEvent = {
    category,
    message,
    timestamp: new Date().toISOString(),
  }
  try {
    webContents.send('app:error', event)
  } catch {
    // Renderer may be navigating — not critical
  }
}

/**
 * Wrap a promise-returning function and emit errors to the renderer
 * instead of letting them propagate silently.
 *
 * Usage:
 *   await withErrorEmit(webContents, 'sync', () => syncService.push(password))
 */
export async function withErrorEmit<T>(
  webContents: WebContents | null | undefined,
  category: ErrorCategory,
  fn: () => Promise<T>
): Promise<T | undefined> {
  try {
    return await fn()
  } catch (err: any) {
    const message = err?.message ?? String(err)
    emitError(webContents, category, message)
    return undefined
  }
}
