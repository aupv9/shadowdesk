/**
 * Phase 12.C.3 — Encrypted credential vault.
 *
 * In-process credential store with master-password unlock. Each credential
 * record stores `username`, `password`, and an arbitrary `fields` JSON blob,
 * each encrypted separately with AES-256-GCM. The encryption key is derived
 * from the master password + a random per-vault salt via scrypt.
 *
 * Threat model:
 * - Vault file (sqlite) at rest: protected by AES-256-GCM with a key the
 *   user must provide on every unlock. Loss of the password = unrecoverable.
 * - Active session in memory: the derived key is held in process RAM until
 *   `lock()` is called. Auto-locks after `vault.idleTimeoutMinutes` minutes
 *   of no `getCredential` calls.
 * - Master-password verification: a sentinel string ("vault-ok") is encrypted
 *   on first unlock and re-decrypted on every subsequent unlock to detect a
 *   wrong password without leaking ciphertext shape.
 */

import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual
} from 'crypto'
import { Database } from './database'
import { getSettings } from './settings'

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 32
const IV_LEN = 12 // GCM
const SALT_KEY = 'vault.salt'
const SENTINEL_KEY = 'vault.sentinel'
const SENTINEL_PLAINTEXT = 'vault-ok'

interface VaultState {
  key: Buffer
  unlockedAt: number
  lastAccessAt: number
}

export interface VaultCredential {
  id: string
  profile_id: string | null
  label: string
  username: string
  password: string
  fields: Record<string, string>
  created_at: string
  updated_at: string
}

class Vault {
  private state: VaultState | null = null

  isUnlocked(): boolean {
    if (!this.state) return false
    if (this.isIdleExpired()) {
      this.lock()
      return false
    }
    return true
  }

  private isIdleExpired(): boolean {
    if (!this.state) return true
    const idleMin = (getSettings() as any)?.vault?.idleTimeoutMinutes ?? 15
    if (idleMin <= 0) return false
    return Date.now() - this.state.lastAccessAt > idleMin * 60_000
  }

  /** Has the vault ever been initialized with a master password? */
  isInitialized(): boolean {
    const db = Database.getInstance()
    return !!db.getVaultMeta(SENTINEL_KEY)
  }

  /** Unlock with the master password. First call also initializes the vault. */
  unlock(masterPassword: string): { ok: boolean; created: boolean } {
    const db = Database.getInstance()
    let salt = db.getVaultMeta(SALT_KEY)
    let created = false

    if (!salt) {
      // First-ever unlock — initialize the vault
      salt = randomBytes(16).toString('hex')
      db.setVaultMeta(SALT_KEY, salt)
      const key = scryptSync(masterPassword, Buffer.from(salt, 'hex'), KEY_LEN, {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P
      })
      const sentinel = encryptWithKey(SENTINEL_PLAINTEXT, key)
      db.setVaultMeta(SENTINEL_KEY, sentinel)
      this.state = { key, unlockedAt: Date.now(), lastAccessAt: Date.now() }
      created = true
      return { ok: true, created }
    }

    const key = scryptSync(masterPassword, Buffer.from(salt, 'hex'), KEY_LEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P
    })
    // Verify by decrypting the sentinel
    const sentinel = db.getVaultMeta(SENTINEL_KEY)
    if (!sentinel) {
      // Salt without sentinel — corrupted state. Treat as wrong password.
      return { ok: false, created: false }
    }
    try {
      const plain = decryptWithKey(sentinel, key)
      if (!timingSafeEqual(Buffer.from(plain), Buffer.from(SENTINEL_PLAINTEXT))) {
        return { ok: false, created: false }
      }
    } catch {
      return { ok: false, created: false }
    }
    this.state = { key, unlockedAt: Date.now(), lastAccessAt: Date.now() }
    return { ok: true, created: false }
  }

  lock(): void {
    if (this.state) {
      // Best-effort: zero the key buffer before releasing
      this.state.key.fill(0)
    }
    this.state = null
  }

  private requireUnlocked(): Buffer {
    if (!this.isUnlocked() || !this.state) {
      throw new Error('Vault is locked — unlock with the master password first')
    }
    this.state.lastAccessAt = Date.now()
    return this.state.key
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  list(profileId?: string): VaultCredential[] {
    const key = this.requireUnlocked()
    const db = Database.getInstance()
    const rows = db.getAllCredentials(profileId)
    return rows.map((r) => this.decryptRow(r, key))
  }

  get(id: string): VaultCredential {
    const key = this.requireUnlocked()
    const db = Database.getInstance()
    const row = db.getCredential(id)
    if (!row) throw new Error(`Credential ${id} not found`)
    return this.decryptRow(row, key)
  }

  create(input: {
    profile_id: string | null
    label: string
    username: string
    password: string
    fields?: Record<string, string>
  }): VaultCredential {
    const key = this.requireUnlocked()
    const db = Database.getInstance()
    const id = randomBytes(8).toString('hex')
    db.createCredential({
      id,
      profile_id: input.profile_id,
      label: input.label,
      username_enc: encryptWithKey(input.username, key),
      password_enc: encryptWithKey(input.password, key),
      fields_enc: input.fields ? encryptWithKey(JSON.stringify(input.fields), key) : null
    })
    return this.get(id)
  }

  update(
    id: string,
    data: Partial<{
      label: string
      username: string
      password: string
      fields: Record<string, string>
      profile_id: string | null
    }>
  ): VaultCredential {
    const key = this.requireUnlocked()
    const db = Database.getInstance()
    const enc: Parameters<typeof db.updateCredential>[1] = {}
    if (data.label !== undefined) enc.label = data.label
    if (data.username !== undefined) enc.username_enc = encryptWithKey(data.username, key)
    if (data.password !== undefined) enc.password_enc = encryptWithKey(data.password, key)
    if (data.fields !== undefined) enc.fields_enc = encryptWithKey(JSON.stringify(data.fields), key)
    if (data.profile_id !== undefined) enc.profile_id = data.profile_id
    db.updateCredential(id, enc)
    return this.get(id)
  }

  delete(id: string): void {
    this.requireUnlocked()
    Database.getInstance().deleteCredential(id)
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private decryptRow(row: any, key: Buffer): VaultCredential {
    let fields: Record<string, string> = {}
    if (row.fields_enc) {
      try {
        const raw = decryptWithKey(row.fields_enc, key)
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') fields = parsed
      } catch {
        // ignore — corrupt fields blob
      }
    }
    return {
      id: row.id,
      profile_id: row.profile_id,
      label: row.label,
      username: decryptWithKey(row.username_enc, key),
      password: decryptWithKey(row.password_enc, key),
      fields,
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  }
}

// ── AES-GCM helpers ──────────────────────────────────────────────────────

/** Encrypt a UTF-8 string with the given 32-byte key. Returns "iv:tag:ciphertext" hex. */
function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`
}

/** Decrypt the inverse of `encryptWithKey`. Throws on tampering / wrong key. */
function decryptWithKey(payload: string, key: Buffer): string {
  const parts = payload.split(':')
  if (parts.length !== 3) throw new Error('Malformed vault payload')
  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const ct = Buffer.from(parts[2], 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

// ── Singleton ───────────────────────────────────────────────────────────

let _vault: Vault | null = null
export function getVault(): Vault {
  if (!_vault) _vault = new Vault()
  return _vault
}
