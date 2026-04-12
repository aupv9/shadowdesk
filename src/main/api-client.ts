import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { AuthTokens, CommonApiResponse, CommonApiError } from '../shared/types'

const API_BASE_URL = process.env.GHOST_API_URL || 'https://api.ghostbrowser.app'
const API_VERSION_PREFIX = '/api/v1'
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

async function refreshAccessToken(): Promise<boolean> {
  const current = loadTokens()
  if (!current?.refresh_token) return false

  try {
    const res = await fetch(`${API_BASE_URL}${API_VERSION_PREFIX}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: current.refresh_token })
    })
    if (!res.ok) return false

    const json = await res.json()
    // Common SaaS wraps in { success, data } envelope
    const data = json?.success && json.data ? json.data : json
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

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    authenticated?: boolean
    /** Skip /api/v1 prefix (e.g. for health checks) */
    rawPath?: boolean
  } = {}
): Promise<T> {
  const { method = 'GET', body, authenticated = true, rawPath = false } = options

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

  const fullPath = rawPath ? path : `${API_VERSION_PREFIX}${path}`
  let res: Response | undefined
  let rateLimitRetries = 0

  while (rateLimitRetries <= MAX_RATE_LIMIT_RETRIES) {
    res = await fetch(`${API_BASE_URL}${fullPath}`, {
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

  if (res.status === 401) {
    if (authenticated && !apiKey) {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        return apiRequest<T>(path, { method, body, authenticated, rawPath })
      }
    }
    throw new Error('AUTH_EXPIRED')
  }

  if (res.status === 429) {
    const err = await res.json().catch(() => ({})) as Partial<CommonApiResponse<unknown>>
    const retryAfter = err?.error?.details?.retry_after_seconds ?? 60
    throw new Error(`RATE_LIMIT: retry after ${retryAfter}s`)
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ message: res!.statusText }))
    // Parse Common SaaS error envelope
    if (errBody?.success === false && errBody.error) {
      const apiErr = errBody.error as CommonApiError
      const msg = apiErr.message || `API error ${res.status}`
      const error = new Error(msg) as Error & { code?: string; details?: unknown }
      error.code = apiErr.code
      error.details = apiErr.details
      throw error
    }
    throw new Error(errBody.message || `API error ${res.status}`)
  }

  if (res.status === 204) return undefined as T

  const json = await res.json()

  // Unwrap Common SaaS { success, data } envelope
  if (json && typeof json === 'object' && json.success === true && 'data' in json) {
    return json.data as T
  }

  return json as T
}

export function getApiBaseUrl(): string {
  return API_BASE_URL
}

export function getApiVersionPrefix(): string {
  return API_VERSION_PREFIX
}
