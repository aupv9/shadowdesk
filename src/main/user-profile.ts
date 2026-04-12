import { apiRequest, getApiBaseUrl, getApiVersionPrefix, loadTokens } from './api-client'
import type { User } from '../shared/types'

/**
 * Common SaaS User Profile Service
 * Endpoints: /api/v1/profiles/{user_id}
 *
 * Manages the authenticated user's profile on the Common SaaS backend
 * (display name, avatar, metadata). Not to be confused with browser
 * profiles, which are stored locally in SQLite.
 */

export interface UserProfile {
  user_id: string
  display_name?: string
  avatar_url?: string
  bio?: string
  timezone?: string
  language?: string
  metadata?: Record<string, unknown>
  updated_at?: string
}

/** Fetch the user profile from Common SaaS. */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    return await apiRequest<UserProfile>(`/profiles/${userId}`)
  } catch {
    return null
  }
}

/** Update the user profile on Common SaaS. */
export async function updateUserProfile(
  userId: string,
  data: Partial<Pick<UserProfile, 'display_name' | 'bio' | 'timezone' | 'language' | 'metadata'>>
): Promise<UserProfile> {
  return apiRequest<UserProfile>(`/profiles/${userId}`, {
    method: 'PUT',
    body: data
  })
}

/**
 * Upload a user avatar. Uses multipart/form-data, so we bypass the
 * standard JSON apiRequest and use fetch directly with auth headers.
 */
export async function uploadAvatar(userId: string, imageBuffer: Buffer, filename: string): Promise<{ avatar_url: string }> {
  const tokens = loadTokens()
  if (!tokens?.access_token) throw new Error('AUTH_EXPIRED')

  const formData = new FormData()
  const blob = new Blob([imageBuffer as unknown as BlobPart], { type: 'image/png' })
  formData.append('avatar', blob, filename)

  const res = await fetch(
    `${getApiBaseUrl()}${getApiVersionPrefix()}/profiles/${userId}/avatar`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      },
      body: formData
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err?.error?.message ?? err.message ?? `Upload failed: ${res.status}`)
  }

  const json = await res.json()
  return json?.data ?? json
}
