import { getDatabase } from '../../config/database'
import type { UserProfile } from '../../types'

export interface UpdateProfileInput {
  display_name?: string | null
  bio?: string | null
  timezone?: string | null
  language?: string | null
  metadata?: Record<string, unknown>
}

export class ProfileService {
  async getProfile(userId: string): Promise<UserProfile> {
    const db = getDatabase()
    const row = await db('user_profiles').where({ user_id: userId }).first()
    // Return a default (empty) profile rather than 404 — the client treats a
    // profile as always-present for the authenticated user.
    if (!row) return { user_id: userId }
    return this.format(row)
  }

  async updateProfile(userId: string, data: UpdateProfileInput): Promise<UserProfile> {
    const db = getDatabase()
    const now = new Date()

    const patch: Record<string, unknown> = { updated_at: now }
    if (data.display_name !== undefined) patch.display_name = data.display_name
    if (data.bio !== undefined) patch.bio = data.bio
    if (data.timezone !== undefined) patch.timezone = data.timezone
    if (data.language !== undefined) patch.language = data.language
    if (data.metadata !== undefined) patch.metadata = JSON.stringify(data.metadata)

    await db('user_profiles')
      .insert({ user_id: userId, created_at: now, ...patch })
      .onConflict('user_id')
      .merge(patch)

    return this.getProfile(userId)
  }

  async setAvatar(userId: string, url: string, storagePath: string): Promise<UserProfile> {
    const db = getDatabase()
    const now = new Date()
    await db('user_profiles')
      .insert({ user_id: userId, avatar_url: url, avatar_path: storagePath, created_at: now, updated_at: now })
      .onConflict('user_id')
      .merge({ avatar_url: url, avatar_path: storagePath, updated_at: now })
    return this.getProfile(userId)
  }

  private format(row: any): UserProfile {
    return {
      user_id: row.user_id,
      display_name: row.display_name ?? null,
      avatar_url: row.avatar_url ?? null,
      bio: row.bio ?? null,
      timezone: row.timezone ?? null,
      language: row.language ?? null,
      metadata: row.metadata ?? {},
      updated_at: row.updated_at
    }
  }
}

export const profileService = new ProfileService()
