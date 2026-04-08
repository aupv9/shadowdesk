export type ErrorCode =
  // Auth
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_EMAIL_NOT_VERIFIED'
  | 'AUTH_EMAIL_ALREADY_EXISTS'
  | 'AUTH_INVALID_RESET_TOKEN'
  // License
  | 'LICENSE_INVALID_KEY'
  | 'LICENSE_ALREADY_ACTIVATED'
  | 'LICENSE_SEATS_EXCEEDED'
  | 'LICENSE_EXPIRED'
  | 'LICENSE_PLAN_LIMIT'
  | 'LICENSE_NOT_FOUND'
  // Team
  | 'TEAM_NOT_FOUND'
  | 'TEAM_ALREADY_EXISTS'
  | 'TEAM_MEMBER_LIMIT'
  | 'TEAM_INVITE_EXPIRED'
  | 'TEAM_INVITE_NOT_FOUND'
  | 'TEAM_PERMISSION_DENIED'
  | 'TEAM_MEMBER_NOT_FOUND'
  // Sync
  | 'SYNC_CHECKSUM_MISMATCH'
  | 'SYNC_NOT_ENABLED'
  | 'SYNC_NO_DATA'
  // Webhook
  | 'WEBHOOK_NOT_FOUND'
  | 'WEBHOOK_LIMIT_EXCEEDED'
  // General
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'FORBIDDEN'

const HTTP_STATUS: Record<ErrorCode, number> = {
  AUTH_INVALID_CREDENTIALS:  401,
  AUTH_TOKEN_EXPIRED:        401,
  AUTH_TOKEN_INVALID:        401,
  AUTH_EMAIL_NOT_VERIFIED:   403,
  AUTH_EMAIL_ALREADY_EXISTS: 409,
  AUTH_INVALID_RESET_TOKEN:  400,

  LICENSE_INVALID_KEY:       400,
  LICENSE_ALREADY_ACTIVATED: 409,
  LICENSE_SEATS_EXCEEDED:    402,
  LICENSE_EXPIRED:           402,
  LICENSE_PLAN_LIMIT:        402,
  LICENSE_NOT_FOUND:         404,

  TEAM_NOT_FOUND:            404,
  TEAM_ALREADY_EXISTS:       409,
  TEAM_MEMBER_LIMIT:         402,
  TEAM_INVITE_EXPIRED:       410,
  TEAM_INVITE_NOT_FOUND:     404,
  TEAM_PERMISSION_DENIED:    403,
  TEAM_MEMBER_NOT_FOUND:     404,

  SYNC_CHECKSUM_MISMATCH:    422,
  SYNC_NOT_ENABLED:          402,
  SYNC_NO_DATA:              404,

  WEBHOOK_NOT_FOUND:         404,
  WEBHOOK_LIMIT_EXCEEDED:    402,

  VALIDATION_ERROR:          400,
  NOT_FOUND:                 404,
  RATE_LIMITED:              429,
  INTERNAL_ERROR:            500,
  FORBIDDEN:                 403,
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly statusCode: number

  constructor(code: ErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'AppError'
    this.code = code
    this.statusCode = HTTP_STATUS[code] ?? 500
  }

  toJSON() {
    return { error: { code: this.code, message: this.message } }
  }
}

// Fastify error handler — register in app.ts
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

export function globalErrorHandler(
  error: FastifyError | AppError | ZodError | Error,
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(error.toJSON())
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.flatten().fieldErrors,
      },
    })
  }

  // Fastify validation error
  if ('statusCode' in error && error.statusCode === 400) {
    return reply.status(400).send({
      error: { code: 'VALIDATION_ERROR', message: error.message },
    })
  }

  console.error('Unhandled error:', error)
  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  })
}
