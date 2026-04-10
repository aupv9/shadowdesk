import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'
import { unauthorized } from '../utils/errors'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      userEmail?: string
    }
  }
}

/**
 * Verify JWT token and attach user info to request
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      throw unauthorized('Missing or invalid authorization header')
    }

    const token = authHeader.slice(7)
    const payload = verifyToken(token)

    req.userId = payload.userId
    req.userEmail = payload.email

    next()
  } catch (error) {
    throw unauthorized(error instanceof Error ? error.message : 'Invalid token')
  }
}

/**
 * Optional auth - sets user info if token present, doesn't fail if missing
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const payload = verifyToken(token)
      req.userId = payload.userId
      req.userEmail = payload.email
    }
  } catch {
    // Ignore auth errors in optional mode
  }

  next()
}
