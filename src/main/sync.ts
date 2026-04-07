import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto'
import { BrowserWindow } from 'electron'
import { apiRequest } from './api-client'
import { Database } from './database'
import { isAuthenticated } from './auth'
import { getCurrentLicense } from './license'
import type { SyncStatus, SyncManifest } from '../shared/types'

const ALGORITHM = 'aes-256-gcm'
const SCRYPT_KEYLEN = 32
const SCRYPT_SALT = 'ghost-browser-sync-salt-v1' // fixed salt — key uniqueness comes from password

let syncStatus: SyncStatus = 'idle'
let lastSyncedAt: string | null = null
let pendingChanges = 0
let syncTimer: ReturnType<typeof setInterval> | null = null
let mainWindow: BrowserWindow | null = null

// ── Encryption ───────────────────────────────────────────────────────────────

function deriveKey(password: string): Buffer {
  return scryptSync(password, SCRYPT_SALT, SCRYPT_KEYLEN)
}

export function encrypt(data: string, password: string): Buffer {
  const key = deriveKey(password)
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Format: [iv (12)] [authTag (16)] [encrypted data]
  return Buffer.concat([iv, authTag, encrypted])
}

export function decrypt(bundle: Buffer, password: string): string {
  const key = deriveKey(password)
  const iv = bundle.subarray(0, 12)
  const authTag = bundle.subarray(12, 28)
  const encrypted = bundle.subarray(28)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

// ── Sync Operations ──────────────────────────────────────────────────────────

function notifyRenderer(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sync:status', getSyncState())
  }
}

function setStatus(status: SyncStatus, errorMessage?: string): void {
  syncStatus = status
  notifyRenderer()
}

export function getSyncState(): { status: SyncStatus; last_synced_at: string | null; pending_changes: number; error_message?: string } {
  return {
    status: syncStatus,
    last_synced_at: lastSyncedAt,
    pending_changes: pendingChanges
  }
}

export async function pushProfiles(encryptionPassword: string): Promise<void> {
  if (!isAuthenticated()) throw new Error('Not authenticated')
  const license = getCurrentLicense()
  if (!license.cloud_sync_enabled) throw new Error('Cloud sync not available on free plan')

  setStatus('syncing')

  try {
    const db = Database.getInstance()
    const profiles = db.getAllProfiles()

    const payload = JSON.stringify({
      profiles,
      exported_at: new Date().toISOString(),
      version: 1
    })

    const checksum = createHash('sha256').update(payload).digest('hex')
    const encrypted = encrypt(payload, encryptionPassword)

    await apiRequest('/profiles/sync/push', {
      method: 'POST',
      body: {
        data: encrypted.toString('base64'),
        checksum,
        profile_count: profiles.length
      }
    })

    lastSyncedAt = new Date().toISOString()
    pendingChanges = 0
    setStatus('idle')
  } catch (e: any) {
    setStatus('error')
    throw e
  }
}

export async function pullProfiles(encryptionPassword: string): Promise<number> {
  if (!isAuthenticated()) throw new Error('Not authenticated')
  const license = getCurrentLicense()
  if (!license.cloud_sync_enabled) throw new Error('Cloud sync not available on free plan')

  setStatus('syncing')

  try {
    const res = await apiRequest<{ data: string; checksum: string }>('/profiles/sync/pull')

    const bundle = Buffer.from(res.data, 'base64')
    const decrypted = decrypt(bundle, encryptionPassword)

    // Verify checksum
    const checksum = createHash('sha256').update(decrypted).digest('hex')
    if (checksum !== res.checksum) {
      throw new Error('Sync data integrity check failed — incorrect password or corrupted data')
    }

    const payload = JSON.parse(decrypted)
    const db = Database.getInstance()

    let imported = 0
    let conflicts = 0
    for (const profile of payload.profiles) {
      const existing = db.getProfile(profile.id) as any
      if (existing) {
        // Conflict detection: skip overwrite if local is newer
        const localUpdated = existing.updated_at ?? existing.last_used_at ?? ''
        const remoteUpdated = profile.updated_at ?? ''
        if (localUpdated && remoteUpdated && localUpdated > remoteUpdated) {
          conflicts++
          continue // local wins — skip this profile
        }
        db.updateProfile(profile.id, {
          name: profile.name,
          fingerprint: typeof profile.fingerprint === 'string'
            ? JSON.parse(profile.fingerprint)
            : profile.fingerprint,
          cookies: profile.cookies,
          notes: profile.notes,
          group_id: profile.group_id
        })
      } else {
        db.createProfile({
          id: profile.id,
          name: profile.name,
          fingerprint: typeof profile.fingerprint === 'string'
            ? JSON.parse(profile.fingerprint)
            : profile.fingerprint,
          notes: profile.notes,
          user_data_path: profile.user_data_path ?? ''
        })
        if (profile.cookies) {
          db.updateCookies(profile.id, profile.cookies)
        }
      }
      imported++
    }
    if (conflicts > 0) {
      console.info(`[Sync] ${conflicts} profile(s) skipped (local version is newer)`)
    }

    lastSyncedAt = new Date().toISOString()
    pendingChanges = 0
    setStatus('idle')
    return imported
  } catch (e: any) {
    setStatus('error')
    throw e
  }
}

export async function getSyncManifest(): Promise<SyncManifest | null> {
  try {
    return await apiRequest<SyncManifest>('/profiles/sync/manifest')
  } catch {
    return null
  }
}

// ── Background Sync Daemon ───────────────────────────────────────────────────

export function startSyncDaemon(window: BrowserWindow, encryptionPassword: string): void {
  mainWindow = window
  stopSyncDaemon()

  // Sync every 5 minutes
  syncTimer = setInterval(async () => {
    if (!isAuthenticated()) {
      setStatus('offline')
      return
    }

    const license = getCurrentLicense()
    if (!license.cloud_sync_enabled) {
      setStatus('disabled')
      return
    }

    if (pendingChanges > 0) {
      try {
        await pushProfiles(encryptionPassword)
      } catch {
        // Error already set in pushProfiles
      }
    }
  }, 5 * 60 * 1000)
}

export function stopSyncDaemon(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

export function markPendingChange(): void {
  pendingChanges++
  notifyRenderer()
}

export function initSyncWindow(window: BrowserWindow): void {
  mainWindow = window
}
