import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { AuthTokens } from '../shared/types'

/**
 * Ghost Browser API Client
 *
 * Communicates with the Ghost Browser server (Express, no version prefix).
 *
 * Server response format:
 *   Success → raw JSON (no envelope)
 *   Error   → { error: "code", message: "...", code: 400, timestamp: "..." }
 *
 * Routes:
 *   /auth/*            — Authentication
 *   /licenses/*        — License management
 *   /team/*            — Team collaboration
 *   /profiles/sync/*   — Cloud sync
 */

const API_BASE_URL = process.env.GHOST_API_URL || 'https://api.ghostbrowser.app'
const MAX_RATE_LIMIT_RETRIES = 3

let tokens: AuthTokens | null = null
let apiKey: string | null = null

function tokensPath(): string {
  return join(app.getPath('userData'), 'auth-tokens.json')
}

export function loadTokens(): AuthTokens | null {
  if (tokens) return tokens
  const p = tokensPath()
  if (existsSync(p)) {
    try {
      tokens = JSON.parse(readFileSync(p, 'utf-8'))
      return tokens
    } catch {
      return null
    }
  }
  return null
}

export function saveTokens(t: AuthTokens): void {
  tokens = t
  writeFileSync(tokensPath(), JSON.stringify(t, null, 2))
}

export function clearTokens(): void {
  tokens = null
  const p = tokensPath()
  if (existsSync(p)) {
    writeFileSync(p, '')
  }
}

export function setApiKey(key: string | null): void {
  apiKey = key
}

export function getApiKey(): string | null {
  return apiKey
}

/** Decode JWT payload without verification to extract `exp` claim. */
export function decodeJwtExpiry(token: string): number {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return 0
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
    return typeof payload.exp === 'number' ? payload.exp : 0
  } catch {
    return 0
  }
}

function isTokenExpired(): boolean {
  if (!tokens) return true
  return Date.now() >= tokens.expires_at * 1000
}

/**
 * Refresh the access token using the stored refresh token.
 * Server endpoint: POST /auth/refresh
 * Server response: { access_token, refresh_token, expires_at }
 */
async function refreshAccessToken(): Promise<boolean> {
  const current = loadTokens()
  if (!current?.refresh_token) return false

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: current.refresh_token })
    })
    if (!res.ok) return false

    const data = await res.json()
    const accessToken = data.access_token
    const expiresAt = data.expires_at ?? decodeJwtExpiry(accessToken)
    saveTokens({
      access_token: accessToken,
      refresh_token: data.refresh_token ?? current.refresh_token,
      expires_at: expiresAt
    })
    return true
  } catch {
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Make an authenticated API request to the Ghost Browser server.
 *
 * The server returns data directly (no { success, data } envelope).
 * Errors come as { error: "code", message: "...", code: 400, timestamp: "..." }.
 */
export async function apiRequest<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    authenticated?: boolean
  } = {}
): Promise<T> {
  const { method = 'GET', body, authenticated = true } = options

  if (authenticated && !apiKey && isTokenExpired()) {
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      throw new Error('AUTH_EXPIRED')
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Version': app.getVersion()
  }

  if (authenticated) {
    if (apiKey) {
      headers['X-API-Key'] = apiKey
    } else {
      const t = loadTokens()
      if (t) {
        headers['Authorization'] = `Bearer ${t.access_token}`
      }
    }
  }

  let res: Response | undefined
  let rateLimitRetries = 0

  while (rateLimitRetries <= MAX_RATE_LIMIT_RETRIES) {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })

    if (res.status === 429 && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10)
      await sleep(retryAfter * 1000)
      rateLimitRetries++
      continue
    }
    break
  }

  if (!res) throw new Error('No response received')

  // 401 — attempt token refresh once
  if (res.status === 401) {
    if (authenticated && !apiKey) {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        return apiRequest<T>(path, { method, body, authenticated })
      }
    }
    throw new Error('AUTH_EXPIRED')
  }

  // 429 — rate limited after retries exhausted
  if (res.status === 429) {
    const resetHeader = res.headers.get('X-RateLimit-Reset')
    const retryAfter = resetHeader ? Math.max(1, Math.ceil((parseInt(resetHeader) * 1000 - Date.now()) / 1000)) : 60
    throw new Error(`RATE_LIMIT: retry after ${retryAfter}s`)
  }

  // Other errors — parse server error format: { error, message, code, timestamp }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ message: res!.statusText }))
    const msg = errBody.message || `API error ${res.status}`
    const error = new Error(msg) as Error & { code?: string; statusCode?: number }
    error.code = errBody.error ?? 'unknown'
    error.statusCode = errBody.code ?? res.status
    throw error
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  // Server returns data directly — no envelope unwrapping needed
  return res.json() as Promise<T>
}

export function getApiBaseUrl(): string {
  return API_BASE_URL
}
