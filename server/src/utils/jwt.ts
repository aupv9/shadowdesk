import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export interface TokenPayload {
  userId: string
  email: string
  iat?: number
  exp?: number
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/**
 * Parse JWT expiry string (e.g., "15m", "7d") to milliseconds
 */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/)
  if (!match) throw new Error(`Invalid expiry format: ${expiry}`)

  const [, value, unit] = match
  const num = parseInt(value, 10)

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  }

  return num * (multipliers[unit] || 1000)
}

export function createAccessToken(userId: string, email: string): string {
  const expiresIn = parseExpiry(env.JWT_ACCESS_EXPIRY)
  return jwt.sign({ userId, email }, env.JWT_SECRET, {
    expiresIn: Math.floor(expiresIn / 1000),
    issuer: 'ghost-browser-api'
  })
}

export function createRefreshToken(userId: string, email: string): string {
  const expiresIn = parseExpiry(env.JWT_REFRESH_EXPIRY)
  return jwt.sign({ userId, email }, env.JWT_SECRET, {
    expiresIn: Math.floor(expiresIn / 1000),
    issuer: 'ghost-browser-api'
  })
}

export function createTokenPair(userId: string, email: string): TokenPair {
  const accessToken = createAccessToken(userId, email)
  const refreshToken = createRefreshToken(userId, email)
  const expiresIn = parseExpiry(env.JWT_ACCESS_EXPIRY)

  return {
    accessToken,
    refreshToken,
    expiresIn: Math.floor(expiresIn / 1000)
  }
}

export function verifyToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET, {
      issuer: 'ghost-browser-api'
    }) as TokenPayload
  } catch (error) {
    throw new Error(`Invalid token: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload | null
  } catch {
    return null
  }
}
