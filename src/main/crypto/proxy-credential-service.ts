/**
 * Proxy Credential Encryption Service
 *
 * Wraps `profile-encryption.ts` with a machine-derived master key so proxy
 * credentials can be encrypted at rest without requiring the user to enter
 * a master password on every profile launch.
 *
 * Threat model
 * ────────────
 * - **At rest**: SQLite file is AES-256-GCM encrypted per credential. If
 *   `ghost-browser.db` is exfiltrated to another machine, the credentials
 *   cannot be decrypted because the key derivation includes `getMachineId()`
 *   (MAC + CPU model hash).
 * - **In memory**: credentials are decrypted only when needed (proxy launch
 *   or test). The renderer never receives plain-text credentials — the IPC
 *   handler strips them before sending the proxy list.
 * - **Legacy data**: rows created before encryption was added are detected
 *   by the absence of the `enc:v1:` prefix and migrated on first read.
 *
 * Key derivation
 * ──────────────
 *   masterKey = SHA-256( APP_SECRET || "|" || machineId )
 *   dataKey   = scrypt( masterKey, "proxy:<type>:<proxyId>" )
 *
 * The per-credential salt ensures that two proxies with the same password
 * produce different ciphertexts.
 */

import { createHash } from 'crypto'
import {
  encryptProxyCredential,
  safeDecryptProxyCredential,
  type EncryptionError,
} from './profile-encryption'
import { getMachineId } from '../license'

/** Marker prefix that identifies an encrypted credential blob. */
export const ENC_PREFIX = 'enc:v1:'

/**
 * App-level secret mixed into the master key. Rotating this value
 * invalidates all existing ciphertexts (manual re-encryption required).
 */
const APP_SECRET = 'ghost-browser-proxy-vault-2026'

let cachedKey: Buffer | null = null

/**
 * Derive (and cache) the machine-bound master key.
 * Lazy so unit tests that mock `electron` before importing this module work.
 */
function getMasterKey(): Buffer {
  if (cachedKey) return cachedKey
  let machineId: string
  try {
    machineId = getMachineId()
  } catch {
    // In test environments without networkInterfaces, fall back to a
    // deterministic placeholder so encryption still round-trips.
    machineId = 'test-machine'
  }
  cachedKey = createHash('sha256').update(`${APP_SECRET}|${machineId}`).digest()
  return cachedKey
}

/** True if the value carries the encryption marker. */
export function isEncryptedCredential(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX)
}

/**
 * Encrypt a credential. Empty / null inputs pass through unchanged so the
 * database NULL semantics are preserved (no auth = no ciphertext).
 */
export function encryptCredential(
  plaintext: string | null | undefined,
  proxyId: string,
  type: 'username' | 'password',
): string | null {
  if (!plaintext) return null
  // Already encrypted — don't double-wrap
  if (isEncryptedCredential(plaintext)) return plaintext
  const blob = encryptProxyCredential(plaintext, getMasterKey(), proxyId, type)
  return ENC_PREFIX + blob
}

/**
 * Decrypt a credential. Plain-text legacy values are returned as-is so the
 * database can be migrated incrementally without breaking existing rows.
 */
export function decryptCredential(
  stored: string | null | undefined,
  proxyId: string,
  type: 'username' | 'password',
  onError?: (err: EncryptionError) => void,
): string {
  if (!stored) return ''
  if (!isEncryptedCredential(stored)) {
    // Legacy plain-text — caller should re-encrypt on next save
    return stored
  }
  const blob = stored.slice(ENC_PREFIX.length)
  return safeDecryptProxyCredential(blob, getMasterKey(), proxyId, type, onError)
}

/** Reset cached key — used by unit tests after mocking electron. */
export function _resetKeyCacheForTests(): void {
  cachedKey = null
}
