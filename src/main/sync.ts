import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto'
import { BrowserWindow } from 'electron'
import { apiRequest } from './api-client'
import { Database } from './database'
import { isAuthenticated, getCurrentUser } from './auth'
import { getCurrentLicense } from './license'
import type { SyncStatus, SyncManifest, SyncLogEntry, SyncPullResult, SyncConflict, SyncDiff } from '../shared/types'

const ALGORITHM = 'aes-256-gcm'
const SCRYPT_KEYLEN = 32

// Legacy hard-coded salt — kept ONLY as a decryption fallback so that bundles
// pushed before per-user salts were introduced can still be pulled. New
// encryptions always use the per-user salt derived from the authenticated
// user's id.
const LEGACY_SCRYPT_SALT = 'ghost-browser-sync-salt-v1'

// Pepper mixed into the per-user salt. Bumping the version invalidates all
// previously-derived salts (and therefore all previously-encrypted bundles)
// for users who have not yet re-pushed.
const SALT_PEPPER = 'ghost-browser-sync-pepper-v2'

function deriveSalt(userId: string): string {
  return createHash('sha256').update(`${SALT_PEPPER}|${userId}`).digest('hex')
}

async function getActiveUserId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user?.id) throw new Error('Sign in before syncing — user identity required for encryption')
  return user.id
}

let syncStatus: SyncStatus = 'idle'
let lastSyncedAt: string | null = null
let pendingChanges = 0
let syncTimer: ReturnType<typeof setInterval> | null = null
let mainWindow: BrowserWindow | null = null

// Daemon state — in-memory only, never persisted to disk. The user must
// re-enable background sync after every app restart by re-entering the
// encryption password. This is intentional: persisting the password would
// undermine the zero-knowledge guarantee.
let daemonPassword: string | null = null
let daemonEnabled = false

// ── Encryption ───────────────────────────────────────────────────────────────

function deriveKey(password: string, salt: string): Buffer {
  return scryptSync(password, salt, SCRYPT_KEYLEN)
}

function decryptWithKey(bundle: Buffer, key: Buffer): string {
  const iv = bundle.subarray(0, 12)
  const authTag = bundle.subarray(12, 28)
  const encrypted = bundle.subarray(28)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

export function encrypt(data: string, password: string, userId: string): Buffer {
  const key = deriveKey(password, deriveSalt(userId))
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Format: [iv (12)] [authTag (16)] [encrypted data]
  return Buffer.concat([iv, authTag, encrypted])
}

export function decrypt(bundle: Buffer, password: string, userId: string): string {
  // Try the per-user salt first.
  try {
    return decryptWithKey(bundle, deriveKey(password, deriveSalt(userId)))
  } catch {
    // Fallback: bundle was encrypted with the legacy hard-coded salt before
    // per-user salts shipped. After a successful pull, the next push will
    // re-encrypt with the per-user salt automatically.
    return decryptWithKey(bundle, deriveKey(password, LEGACY_SCRYPT_SALT))
  }
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

  const db = Database.getInstance()
  // Selective sync: respect per-profile sync_excluded flag.
  const profiles = db.getSyncableProfiles()

  try {
    const userId = await getActiveUserId()

    const payload = JSON.stringify({
      profiles,
      exported_at: new Date().toISOString(),
      version: 1
    })

    const checksum = createHash('sha256').update(payload).digest('hex')
    const encrypted = encrypt(payload, encryptionPassword, userId)

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
    logSyncEntry('push', profiles.length, 'success')
  } catch (e: any) {
    setStatus('error')
    logSyncEntry('push', profiles.length, 'error', e?.message ?? String(e))
    throw e
  }
}

export async function pullProfiles(encryptionPassword: string): Promise<SyncPullResult> {
  if (!isAuthenticated()) throw new Error('Not authenticated')
  const license = getCurrentLicense()
  if (!license.cloud_sync_enabled) throw new Error('Cloud sync not available on free plan')

  setStatus('syncing')

  try {
    const userId = await getActiveUserId()
    const res = await apiRequest<{ data: string; checksum: string }>('/profiles/sync/pull')

    const bundle = Buffer.from(res.data, 'base64')
    let decrypted: string
    try {
      decrypted = decrypt(bundle, encryptionPassword, userId)
    } catch {
      throw new Error('Failed to decrypt sync data — incorrect encryption password')
    }

    // Verify checksum
    const checksum = createHash('sha256').update(decrypted).digest('hex')
    if (checksum !== res.checksum) {
      throw new Error('Sync data integrity check failed — incorrect password or corrupted data')
    }

    const payload = JSON.parse(decrypted)
    const db = Database.getInstance()

    let imported = 0
    const conflicts: SyncConflict[] = []
    for (const profile of payload.profiles) {
      const existing = db.getProfile(profile.id) as any
      if (existing) {
        // Conflict detection: skip overwrite if local is newer
        const localUpdated = existing.updated_at ?? existing.last_used_at ?? ''
        const remoteUpdated = profile.updated_at ?? ''
        if (localUpdated && remoteUpdated && localUpdated > remoteUpdated) {
          conflicts.push({
            profile_id: profile.id,
            profile_name: existing.name ?? profile.name ?? '(unnamed)',
            local_updated_at: localUpdated || null,
            remote_updated_at: remoteUpdated || null
          })
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
    if (conflicts.length > 0) {
      console.info(`[Sync] ${conflicts.length} profile(s) skipped (local version is newer)`)
    }

    lastSyncedAt = new Date().toISOString()
    pendingChanges = 0
    setStatus('idle')
    logSyncEntry('pull', imported, 'success')
    return { imported, conflicts }
  } catch (e: any) {
    setStatus('error')
    logSyncEntry('pull', 0, 'error', e?.message ?? String(e))
    throw e
  }
}

// ── Sync history ─────────────────────────────────────────────────────────────

function logSyncEntry(
  direction: 'push' | 'pull',
  profileCount: number,
  status: 'success' | 'error',
  errorMessage?: string
): void {
  try {
    Database.getInstance().addSyncEntry({
      id: randomBytes(8).toString('hex'),
      direction,
      profile_count: profileCount,
      status,
      error_message: errorMessage ?? null
    })
  } catch {
    // Logging failure should never break the sync flow.
  }
}

export function getSyncHistory(limit = 20): SyncLogEntry[] {
  try {
    const rows = Database.getInstance().getSyncLog(limit) as any[]
    return rows.map((r) => ({
      id: r.id,
      direction: r.direction,
      profile_count: r.profile_count,
      status: r.status,
      synced_at: r.synced_at,
      error_message: r.error_message ?? null
    }))
  } catch {
    return []
  }
}

export async function getSyncManifest(): Promise<SyncManifest | null> {
  try {
    return await apiRequest<SyncManifest>('/profiles/sync/manifest')
  } catch {
    return null
  }
}

// S3: Compute a local-vs-remote diff so the renderer can show "what
// will change" before the user commits to a push or pull. The diff is
// based on profile ids only — content-level diffs would require
// decrypting the remote bundle, which we deliberately avoid here so the
// preview is cheap and works without re-typing the encryption password.
export async function getSyncDiff(): Promise<SyncDiff> {
  const manifest = await getSyncManifest()
  const localProfiles = Database.getInstance().getSyncableProfiles() as Array<{ id: string; name: string }>
  const remoteIds = new Set(manifest?.profile_ids ?? [])
  const localIdSet = new Set(localProfiles.map((p) => p.id))

  const local_only = localProfiles
    .filter((p) => !remoteIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name }))

  const remote_only: string[] = []
  let shared = 0
  for (const id of remoteIds) {
    if (localIdSet.has(id)) shared++
    else                    remote_only.push(id)
  }

  return {
    local_only,
    remote_only,
    shared,
    local_count: localProfiles.length,
    remote_count: remoteIds.size
  }
}

// ── Background Sync Daemon ───────────────────────────────────────────────────
//
// The daemon is **opt-in** and **off by default**. The user enables it
// from the Account → Cloud Sync UI by providing the encryption password,
// which is held in memory only (never persisted) and cleared on app exit
// or explicit disable. This protects the zero-knowledge property while
// allowing convenient background sync within a session.

export function isDaemonEnabled(): boolean {
  return daemonEnabled
}

/**
 * Enable the background sync daemon for this session. The password is held
 * in memory only and cleared on disable or app exit. Returns true if the
 * daemon was started, false if the license/auth state prevents it.
 */
export function enableSyncDaemon(encryptionPassword: string): boolean {
  if (!encryptionPassword) throw new Error('Encryption password is required to enable background sync')
  if (!isAuthenticated()) throw new Error('Sign in before enabling background sync')
  const license = getCurrentLicense()
  if (!license.cloud_sync_enabled) throw new Error('Cloud sync is not available on the free plan')

  daemonPassword = encryptionPassword
  daemonEnabled = true
  startSyncTimer()
  notifyRenderer()
  return true
}

export function disableSyncDaemon(): void {
  daemonEnabled = false
  daemonPassword = null
  stopSyncTimer()
  notifyRenderer()
}

function startSyncTimer(): void {
  stopSyncTimer()
  // Sync every 5 minutes
  syncTimer = setInterval(async () => {
    if (!daemonEnabled || !daemonPassword) return

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
        await pushProfiles(daemonPassword)
      } catch {
        // Error already set in pushProfiles
      }
    }
  }, 5 * 60 * 1000)
}

function stopSyncTimer(): void {
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
