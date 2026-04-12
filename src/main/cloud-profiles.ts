import { createHash } from 'crypto'
import { join } from 'path'
import { app } from 'electron'
import { apiRequest } from './api-client'
import { Database } from './database'

/**
 * Phase 2 — Cloud Profile Backup & Restore
 *
 * Provides granular cloud backup/restore for individual profiles via the
 * Common SaaS API. Unlike the full sync service (which pushes/pulls all
 * profiles as an encrypted bundle), this service operates at the individual
 * profile level:
 *
 * - Backup: Upload a single profile's fingerprint + metadata to cloud
 * - Restore: Download and apply a cloud-stored profile
 * - List: View all cloud-stored profiles
 * - Delete: Remove a profile from cloud storage
 *
 * Data is NOT encrypted at rest on the server (unlike sync). This is
 * intentional — cloud profiles are meant for sharing across team members
 * and devices without requiring a shared encryption password.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface CloudProfile {
  id: string
  local_id: string | null
  name: string
  fingerprint_hash: string
  preset: string
  proxy_config: {
    type: string
    country?: string
  } | null
  tags: string[]
  notes: string | null
  backed_up_at: string
  updated_at: string
  size_bytes: number
}

export interface CloudProfileDetail extends CloudProfile {
  fingerprint: string // JSON string
  cookies: string | null
  user_data_snapshot: boolean
}

export interface BackupResult {
  cloud_id: string
  fingerprint_hash: string
  backed_up_at: string
  size_bytes: number
}

export interface RestoreResult {
  local_id: string
  name: string
  restored_at: string
  conflicts: string[]
}

export interface CloudProfileListResult {
  profiles: CloudProfile[]
  total: number
  storage_used_bytes: number
  storage_limit_bytes: number
}

// ── Public API ───────────────────────────────────────────────────────────────

/** List all cloud-stored profiles for the authenticated user. */
export async function listCloudProfiles(params?: {
  page?: number
  limit?: number
  search?: string
  tag?: string
}): Promise<CloudProfileListResult> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.search) query.set('search', params.search)
  if (params?.tag) query.set('tag', params.tag)
  const qs = query.toString()

  return apiRequest<CloudProfileListResult>(
    `/cloud-profiles${qs ? `?${qs}` : ''}`
  )
}

/** Backup a local profile to the cloud. */
export async function backupProfile(profileId: string, tags?: string[]): Promise<BackupResult> {
  const db = Database.getInstance()
  const profile = db.getProfile(profileId)

  if (!profile) throw new Error('Profile not found')

  const fpString = typeof profile.fingerprint === 'string'
    ? profile.fingerprint
    : JSON.stringify(profile.fingerprint)

  // Compute fingerprint hash for dedup / change detection
  const fingerprintHash = createHash('sha256')
    .update(fpString || '')
    .digest('hex')
    .slice(0, 16)

  // Get proxy info if linked
  let proxyConfig: { type: string; country?: string } | null = null
  if (profile.proxy_id) {
    const proxy = db.getProxy(profile.proxy_id)
    if (proxy) {
      proxyConfig = { type: proxy.type, country: proxy.country ?? undefined }
    }
  }

  // Extract preset
  let preset = 'unknown'
  try {
    const fp = typeof profile.fingerprint === 'string'
      ? JSON.parse(profile.fingerprint)
      : profile.fingerprint
    preset = fp?.preset || 'custom'
  } catch {
    // ignore parse errors
  }

  const cookies = db.getCookies(profileId)

  return apiRequest<BackupResult>('/cloud-profiles', {
    method: 'POST',
    body: {
      local_id: profile.id,
      name: profile.name,
      fingerprint: fpString,
      fingerprint_hash: fingerprintHash,
      preset,
      proxy_config: proxyConfig,
      cookies: cookies || null,
      notes: profile.notes ?? null,
      tags: tags ?? []
    }
  })
}

/** Backup multiple profiles at once. */
export async function backupProfiles(profileIds: string[], tags?: string[]): Promise<BackupResult[]> {
  const results: BackupResult[] = []
  for (const id of profileIds) {
    try {
      const result = await backupProfile(id, tags)
      results.push(result)
    } catch {
      // Continue on individual failures
    }
  }
  return results
}

/** Restore a cloud profile to the local database. */
export async function restoreCloudProfile(cloudId: string): Promise<RestoreResult> {
  const detail = await apiRequest<CloudProfileDetail>(`/cloud-profiles/${cloudId}`)

  const db = Database.getInstance()
  const conflicts: string[] = []

  // Check if a profile with the same local_id already exists
  if (detail.local_id) {
    const existing = db.getProfile(detail.local_id)
    if (existing) {
      conflicts.push(`Profile with ID ${detail.local_id} already exists locally — creating new copy`)
    }
  }

  const { v4: uuidv4 } = await import('uuid')
  const newId = conflicts.length > 0 ? uuidv4() : (detail.local_id ?? uuidv4())
  const name = conflicts.length > 0 ? `${detail.name} (restored)` : detail.name

  // Use the createProfile method from database
  const userDataPath = join(app.getPath('userData'), 'profiles', newId)
  const fpObj = typeof detail.fingerprint === 'string'
    ? JSON.parse(detail.fingerprint)
    : detail.fingerprint
  db.createProfile({
    id: newId,
    name,
    fingerprint: fpObj,
    proxy_id: null,
    notes: detail.notes ?? '',
    user_data_path: userDataPath
  })

  return {
    local_id: newId,
    name,
    restored_at: new Date().toISOString(),
    conflicts
  }
}

/** Delete a cloud profile. */
export async function deleteCloudProfile(cloudId: string): Promise<void> {
  await apiRequest(`/cloud-profiles/${cloudId}`, { method: 'DELETE' })
}

/** Delete multiple cloud profiles. */
export async function deleteCloudProfiles(cloudIds: string[]): Promise<void> {
  await apiRequest('/cloud-profiles/bulk-delete', {
    method: 'POST',
    body: { ids: cloudIds }
  })
}

/** Update tags for a cloud profile. */
export async function updateCloudProfileTags(cloudId: string, tags: string[]): Promise<CloudProfile> {
  return apiRequest<CloudProfile>(`/cloud-profiles/${cloudId}`, {
    method: 'PATCH',
    body: { tags }
  })
}

/** Get cloud storage usage summary. */
export async function getCloudStorageUsage(): Promise<{
  used_bytes: number
  limit_bytes: number
  profile_count: number
}> {
  return apiRequest('/cloud-profiles/usage')
}
