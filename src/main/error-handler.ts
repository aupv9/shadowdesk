/**
 * Structured Error Handling for IPC Handlers
 *
 * Provides consistent error responses across all IPC endpoints.
 * - Wraps async handlers with automatic error catching
 * - Returns structured error envelopes to renderer
 * - Logs all errors for diagnostics + audit trail
 * - Distinguishes between user errors (validation) and system errors (DB)
 */

import { app } from 'electron'

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'DATABASE_ERROR'
  | 'ENCRYPTION_ERROR'
  | 'FILE_SYSTEM_ERROR'
  | 'INVALID_STATE'
  | 'INTERNAL_ERROR'

export interface IpcError {
  code: ErrorCode
  message: string
  details?: Record<string, unknown>
}

export interface IpcResponse<T> {
  success: boolean
  data?: T
  error?: IpcError
}

/**
 * Wraps async IPC handler with error catching and structured responses.
 *
 * Usage:
 * ```
 * ipcMain.handle('profiles:create', withErrorHandling(async (event, input) => {
 *   const err = validateCreateProfileInput(input)
 *   if (err) throw new ValidationError(err)
 *   return db.createProfile(input)
 * }))
 * ```
 */
export function withErrorHandling<T>(
  handler: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<T>,
  options?: {
    channel?: string
    logErrors?: boolean
  },
): (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<IpcResponse<T>> {
  const channel = options?.channel || 'unknown'
  const logErrors = options?.logErrors !== false

  return async (event, ...args) => {
    try {
      const result = await handler(event, ...args)
      return {
        success: true,
        data: result,
      }
    } catch (error) {
      const ipcError = normalizeError(error)

      if (logErrors) {
        logIpcError(channel, ipcError, error)
      }

      return {
        success: false,
        error: ipcError,
      }
    }
  }
}

/**
 * Synchronous version for handlers that don't need async.
 */
export function withSyncErrorHandling<T>(
  handler: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => T,
  options?: {
    channel?: string
    logErrors?: boolean
  },
): (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => IpcResponse<T> {
  const channel = options?.channel || 'unknown'
  const logErrors = options?.logErrors !== false

  return (event, ...args) => {
    try {
      const result = handler(event, ...args)
      return {
        success: true,
        data: result,
      }
    } catch (error) {
      const ipcError = normalizeError(error)

      if (logErrors) {
        logIpcError(channel, ipcError, error)
      }

      return {
        success: false,
        error: ipcError,
      }
    }
  }
}

/**
 * Custom error classes for different error types.
 */

export class ValidationError extends Error {
  code: ErrorCode = 'VALIDATION_ERROR'

  constructor(
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends Error {
  code: ErrorCode = 'NOT_FOUND'

  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class AlreadyExistsError extends Error {
  code: ErrorCode = 'ALREADY_EXISTS'

  constructor(message: string) {
    super(message)
    this.name = 'AlreadyExistsError'
  }
}

export class DatabaseError extends Error {
  code: ErrorCode = 'DATABASE_ERROR'

  constructor(
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export class EncryptionError extends Error {
  code: ErrorCode = 'ENCRYPTION_ERROR'

  constructor(
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'EncryptionError'
  }
}

export class FileSystemError extends Error {
  code: ErrorCode = 'FILE_SYSTEM_ERROR'

  constructor(
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'FileSystemError'
  }
}

export class InvalidStateError extends Error {
  code: ErrorCode = 'INVALID_STATE'

  constructor(message: string) {
    super(message)
    this.name = 'InvalidStateError'
  }
}

/**
 * Converts any error to normalized IpcError structure.
 */
function normalizeError(error: unknown): IpcError {
  if (error instanceof ValidationError) {
    return {
      code: 'VALIDATION_ERROR',
      message: error.message,
      details: error.details,
    }
  }

  if (error instanceof NotFoundError) {
    return {
      code: 'NOT_FOUND',
      message: error.message,
    }
  }

  if (error instanceof AlreadyExistsError) {
    return {
      code: 'ALREADY_EXISTS',
      message: error.message,
    }
  }

  if (error instanceof DatabaseError) {
    return {
      code: 'DATABASE_ERROR',
      message: error.message,
      details: error.details,
    }
  }

  if (error instanceof EncryptionError) {
    return {
      code: 'ENCRYPTION_ERROR',
      message: error.message,
      details: error.details,
    }
  }

  if (error instanceof FileSystemError) {
    return {
      code: 'FILE_SYSTEM_ERROR',
      message: error.message,
      details: error.details,
    }
  }

  if (error instanceof InvalidStateError) {
    return {
      code: 'INVALID_STATE',
      message: error.message,
    }
  }

  if (error instanceof Error) {
    return {
      code: 'INTERNAL_ERROR',
      message: error.message,
    }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: String(error),
  }
}

/**
 * Logs IPC errors with full context for diagnostics.
 */
function logIpcError(channel: string, ipcError: IpcError, originalError: unknown): void {
  const timestamp = new Date().toISOString()
  const errorLog = {
    timestamp,
    channel,
    code: ipcError.code,
    message: ipcError.message,
    details: ipcError.details,
    stack: originalError instanceof Error ? originalError.stack : undefined,
  }

  // Log to console
  console.error(`[IPC Error] ${channel}:`, errorLog)

  // TODO: Send to diagnostic log file or remote logger
  // Example: await diagnosticLogger.log(errorLog)
}

/**
 * Safe async cleanup wrapper.
 * Ensures cleanup functions don't crash the handler.
 */
export async function safeCleanup(fn: () => Promise<void>, label: string): Promise<void> {
  try {
    await fn()
  } catch (error) {
    console.error(`[Cleanup Error] ${label}:`, error)
    // Don't throw — allow handler to complete even if cleanup fails
  }
}

/**
 * Retry helper for transient failures.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number
    delayMs?: number
    backoffMultiplier?: number
  },
): Promise<T> {
  const maxAttempts = options?.maxAttempts || 3
  const delayMs = options?.delayMs || 100
  const backoff = options?.backoffMultiplier || 2

  let lastError: Error | null = null
  let currentDelay = delayMs

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, currentDelay))
        currentDelay *= backoff
      }
    }
  }

  throw lastError || new Error('All retry attempts failed')
}
