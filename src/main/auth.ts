import { apiRequest, saveTokens, clearTokens, loadTokens, decodeJwtExpiry } from './api-client'
import type { User, LoginInput, RegisterInput, AuthTokens, CommonAuthResponse } from '../shared/types'

let currentUser: User | null = null

/**
 * Save tokens from a Common SaaS auth response.
 * The backend may or may not include `expires_at`; when absent we decode the
 * JWT `exp` claim so the token-refresh logic still works.
 */
function persistTokens(data: CommonAuthResponse): void {
  const expiresAt = data.expires_at ?? decodeJwtExpiry(data.access_token)
  saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt
  })
}

export async function login(input: LoginInput): Promise<User> {
  const res = await apiRequest<CommonAuthResponse>('/auth/login', {
    method: 'POST',
    body: input,
    authenticated: false
  })
  persistTokens(res)

  // Common SaaS login returns tokens + user_id but not the full user
  // object — fetch the profile in a second call.
  const user = await apiRequest<User>('/auth/me')
  currentUser = user
  return user
}

export async function register(input: RegisterInput): Promise<User> {
  const res = await apiRequest<CommonAuthResponse>('/auth/register', {
    method: 'POST',
    body: input,
    authenticated: false
  })
  persistTokens(res)

  const user = await apiRequest<User>('/auth/me')
  currentUser = user
  return user
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' })
  } catch {
    // Best effort — clear local tokens regardless
  }
  currentUser = null
  clearTokens()
}

export async function getCurrentUser(): Promise<User | null> {
  if (currentUser) return currentUser

  const tokens = loadTokens()
  if (!tokens?.access_token) return null

  try {
    const user = await apiRequest<User>('/auth/me')
    currentUser = user
    return user
  } catch {
    return null
  }
}

export async function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiRequest('/auth/password', {
    method: 'PUT',
    body: { current_password: currentPassword, new_password: newPassword }
  })
}

// D4: Re-send verification email. Backend should rate-limit; the renderer
// also enforces a 60-second cooldown so users don't spam.
export async function resendVerificationEmail(): Promise<void> {
  await apiRequest('/auth/verify-email/resend', { method: 'POST' })
}

// E3: GDPR data export. Returns a JSON blob containing the user's
// personal data so the renderer can let them download it.
export async function exportUserData(): Promise<unknown> {
  return apiRequest<unknown>('/auth/me/export', { method: 'POST' })
}

// E3: Permanent account deletion. The backend signs the user out by
// invalidating the refresh token; we still call clearTokens() locally
// in case the request succeeded but the response was lost.
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
