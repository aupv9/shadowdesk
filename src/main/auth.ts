import { apiRequest, saveTokens, clearTokens, loadTokens, decodeJwtExpiry } from './api-client'
import type { User, LoginInput, RegisterInput, AuthTokens } from '../shared/types'

let currentUser: User | null = null

/**
 * Server login/register response shape:
 * {
 *   user: { id, email, full_name, email_verified, status, created_at, updated_at },
 *   tokens: { access_token, refresh_token, expires_at }
 * }
 */
interface ServerAuthResponse {
  user: {
    id: string
    email: string
    full_name: string | null
    email_verified: boolean
    status: string
    created_at: string
    updated_at: string
  }
  tokens: {
    access_token: string
    refresh_token: string
    expires_at: number
  }
}

/** Map server user to client User type. */
function mapUser(serverUser: ServerAuthResponse['user']): User {
  return {
    id: serverUser.id,
    email: serverUser.email,
    name: serverUser.full_name ?? serverUser.email.split('@')[0],
    email_verified: serverUser.email_verified,
    created_at: serverUser.created_at
  }
}

/** Save tokens from a server auth response. */
function persistTokens(tokens: ServerAuthResponse['tokens']): void {
  const expiresAt = tokens.expires_at ?? decodeJwtExpiry(tokens.access_token)
  saveTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt
  })
}

/**
 * POST /auth/login
 * Request: { email, password }
 * Response: { user, tokens }
 */
export async function login(input: LoginInput): Promise<User> {
  const res = await apiRequest<ServerAuthResponse>('/auth/login', {
    method: 'POST',
    body: input,
    authenticated: false
  })
  persistTokens(res.tokens)
  currentUser = mapUser(res.user)
  return currentUser
}

/**
 * POST /auth/register
 * Request: { email, password, full_name }
 * Response: { user, tokens }
 */
export async function register(input: RegisterInput): Promise<User> {
  const res = await apiRequest<ServerAuthResponse>('/auth/register', {
    method: 'POST',
    body: {
      email: input.email,
      password: input.password,
      full_name: input.name
    },
    authenticated: false
  })
  persistTokens(res.tokens)
  currentUser = mapUser(res.user)
  return currentUser
}

/**
 * POST /auth/logout
 * Request: { refresh_token }
 * Response: 204 No Content
 */
export async function logout(): Promise<void> {
  try {
    const tokens = loadTokens()
    await apiRequest('/auth/logout', {
      method: 'POST',
      body: { refresh_token: tokens?.refresh_token }
    })
  } catch {
    // Best effort — clear local tokens regardless
  }
  currentUser = null
  clearTokens()
}

/**
 * GET /auth/me
 * Response: { id, email, full_name, email_verified, status, created_at, updated_at }
 */
export async function getCurrentUser(): Promise<User | null> {
  if (currentUser) return currentUser

  const tokens = loadTokens()
  if (!tokens?.access_token) return null

  try {
    const serverUser = await apiRequest<ServerAuthResponse['user']>('/auth/me')
    currentUser = mapUser(serverUser)
    return currentUser
  } catch {
    return null
  }
}

/**
 * PUT /auth/password
 * Request: { current_password, new_password }
 * Response: 204 No Content
 */
export async function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiRequest('/auth/password', {
    method: 'PUT',
    body: { current_password: currentPassword, new_password: newPassword }
  })
}

/**
 * POST /auth/verify-email/resend
 * Response: 204 No Content
 */
export async function resendVerificationEmail(): Promise<void> {
  await apiRequest('/auth/verify-email/resend', { method: 'POST' })
}

/**
 * POST /auth/me/export
 * Response: { user, exported_at }
 */
export async function exportUserData(): Promise<unknown> {
  return apiRequest<unknown>('/auth/me/export', { method: 'POST' })
}

/**
 * DELETE /auth/me
 * Response: 204 No Content
 */
export async function deleteAccount(): Promise<void> {
  try {
    await apiRequest('/auth/me', { method: 'DELETE' })
  } finally {
    currentUser = null
    clearTokens()
  }
}

export function isAuthenticated(): boolean {
  const tokens = loadTokens()
  return tokens !== null && tokens.access_token.length > 0
}
