import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'

export interface ErrorResponse {
  error: string
  message: string
  code: number
  timestamp: string
  requestId?: string
}

/**
 * Global error handler - must be last middleware
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  const timestamp = new Date().toISOString()
  const requestId = req.headers['x-request-id'] as string

  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: err.errorCode,
      message: err.message,
      code: err.statusCode,
      timestamp,
      ...(requestId && { requestId })
    }

    // Log only 5xx errors
    if (err.statusCode >= 500) {
      logger.error(`[${err.statusCode}] ${err.message}`, {
        error: err,
        requestId,
        path: req.path,
        method: req.method
      })
    }

    res.status(err.statusCode).json(response)
    return
  }

  // Unexpected error
  logger.error('Unexpected error', {
    error: err,
    requestId,
    path: req.path,
    method: req.method,
    stack: err.stack
  })

  const response: ErrorResponse = {
    error: 'internal_error',
    message: 'Internal server error',
    code: 500,
    timestamp,
    ...(requestId && { requestId })
  }

  res.status(500).json(response)
}
