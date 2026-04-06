import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { AuthTokens } from '../shared/types'

const API_BASE_URL = process.env.GHOST_API_URL || 'https://api.ghostbrowser.app'

let tokens: AuthTokens | null = null

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

function isTokenExpired(): boolean {
  if (!tokens) return true
  return Date.now() >= tokens.expires_at * 1000
}

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
    saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? current.refresh_token,
      expires_at: data.expires_at
    })
    return true
  } catch {
    return false
  }
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    authenticated?: boolean
  } = {}
): Promise<T> {
  const { method = 'GET', body, authenticated = true } = options

  if (authenticated && isTokenExpired()) {
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
    const t = loadTokens()
    if (t) {
      headers['Authorization'] = `Bearer ${t.access_token}`
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  if (res.status === 401) {
    // Try refresh once
    if (authenticated) {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        return apiRequest<T>(path, { method, body, authenticated })
      }
    }
    throw new Error('AUTH_EXPIRED')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `API error ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export function getApiBaseUrl(): string {
  return API_BASE_URL
}
