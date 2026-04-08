import { createHash, createHmac, randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { nanoid } from 'nanoid'
import { env } from '../config.js'

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------
export const newId = () => nanoid()

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function hmacSha256(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function secureToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------
const jwtSecret = new TextEncoder().encode(env.JWT_SECRET)

export interface AccessTokenPayload extends JWTPayload {
  sub: string       // user id
  email: string
  plan: string
  teamId?: string
  role?: string
}

export async function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_ACCESS_TTL}s`)
    .sign(jwtSecret)
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_REFRESH_TTL}s`)
    .sign(jwtSecret)
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, jwtSecret)
  return payload as AccessTokenPayload
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, jwtSecret)
  if ((payload as { type?: string }).type !== 'refresh') {
    throw new Error('Not a refresh token')
  }
  return { sub: payload.sub as string }
}

// ---------------------------------------------------------------------------
// Webhook signature
// ---------------------------------------------------------------------------
export function buildWebhookSignature(secret: string, timestamp: number, body: string): string {
  const payload = `${timestamp}.${body}`
  return `sha256=${hmacSha256(secret, payload)}`
}
