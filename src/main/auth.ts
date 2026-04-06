import { apiRequest, saveTokens, clearTokens, loadTokens } from './api-client'
import type { User, LoginInput, RegisterInput, AuthTokens } from '../shared/types'

let currentUser: User | null = null

export async function login(input: LoginInput): Promise<User> {
  const res = await apiRequest<{ user: User; tokens: AuthTokens }>('/auth/login', {
    method: 'POST',
    body: input,
    authenticated: false
  })
  saveTokens(res.tokens)
  currentUser = res.user
  return res.user
}

export async function register(input: RegisterInput): Promise<User> {
  const res = await apiRequest<{ user: User; tokens: AuthTokens }>('/auth/register', {
    method: 'POST',
    body: input,
    authenticated: false
  })
  saveTokens(res.tokens)
  currentUser = res.user
  return res.user
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

export function isAuthenticated(): boolean {
  const tokens = loadTokens()
  return tokens !== null && tokens.access_token.length > 0
}
