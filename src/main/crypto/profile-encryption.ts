import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto'

/**
 * Profile Data Encryption Service
 *
 * Encrypts sensitive profile data (cookies, proxy credentials) at rest using AES-256-GCM.
 * Format: [iv (12 bytes)] [authTag (16 bytes)] [encrypted data]
 *
 * SECURITY NOTE:
 * - Uses deterministic key derivation from a master key + data-specific salt
 * - Every encryption operation generates a fresh 12-byte IV
 * - Auth tag ensures tamper-detection
 * - Decryption failures throw structured errors for caller to handle
 */

const ALGORITHM = 'aes-256-gcm'
const SCRYPT_KEYLEN = 32
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

export interface EncryptionError {
  code: 'DECRYPTION_FAILED' | 'TAMPERED' | 'INVALID_FORMAT'
  message: string
}

/**
 * Derives encryption key from master key and data-specific salt.
 * Uses scrypt with standard parameters matching sync.ts pattern.
 */
function deriveKey(masterKey: Buffer, salt: string): Buffer {
  return scryptSync(masterKey, salt, SCRYPT_KEYLEN, {
    N: 16384,
    r: 8,
    p: 1,
  })
}

/**
 * Encrypts plaintext data using AES-256-GCM.
 * Returns encrypted blob in format: [iv:authTag:ciphertext]
 */
function encryptData(plaintext: string, masterKey: Buffer, salt: string): string {
  const key = deriveKey(masterKey, salt)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Encode as base64 for JSON storage
  const blob = Buffer.concat([iv, authTag, encrypted])
  return blob.toString('base64')
}

/**
 * Decrypts encrypted blob (base64 format).
 * Throws EncryptionError if decryption fails or auth tag doesn't match.
 */
function decryptData(encrypted: string, masterKey: Buffer, salt: string): string {
  try {
    const blob = Buffer.from(encrypted, 'base64')

    if (blob.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('invalid format')
    }

    const iv = blob.subarray(0, IV_LENGTH)
    const authTag = blob.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const ciphertext = blob.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const key = deriveKey(masterKey, salt)
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return decrypted.toString('utf8')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('auth')) {
      throw {
        code: 'TAMPERED' as const,
        message: 'Encrypted data has been tampered with or key is incorrect',
      }
    }

    throw {
      code: 'DECRYPTION_FAILED' as const,
      message: `Failed to decrypt: ${message}`,
    }
  }
}

/**
 * Encrypts profile cookies (JSON array) at rest.
 * Salt: derived from profile ID to ensure same profile always uses same key for re-encryption.
 */
export function encryptCookies(cookiesJson: string, masterKey: Buffer, profileId: string): string {
  const salt = `profile:cookies:${profileId}`
  return encryptData(cookiesJson, masterKey, salt)
}

/**
 * Decrypts profile cookies.
 * Throws EncryptionError on failure.
 */
export function decryptCookies(encrypted: string, masterKey: Buffer, profileId: string): string {
  const salt = `profile:cookies:${profileId}`
  return decryptData(encrypted, masterKey, salt)
}

/**
 * Encrypts proxy credential (username or password).
 * Salt: derived from proxy ID + credential type.
 */
export function encryptProxyCredential(
  credential: string,
  masterKey: Buffer,
  proxyId: string,
  type: 'username' | 'password',
): string {
  const salt = `proxy:${type}:${proxyId}`
  return encryptData(credential, masterKey, salt)
}

/**
 * Decrypts proxy credential.
 * Throws EncryptionError on failure.
 */
export function decryptProxyCredential(
  encrypted: string,
  masterKey: Buffer,
  proxyId: string,
  type: 'username' | 'password',
): string {
  const salt = `proxy:${type}:${proxyId}`
  return decryptData(encrypted, masterKey, salt)
}

/**
 * Safe decryption wrapper for database reads.
 * Returns empty/null on decryption failure instead of throwing.
 * Logs error for diagnostics.
 */
export function safeDecryptCookies(
  encrypted: string | null,
  masterKey: Buffer,
  profileId: string,
  onError?: (err: EncryptionError) => void,
): string {
  if (!encrypted) return '[]'

  try {
    return decryptCookies(encrypted, masterKey, profileId)
  } catch (error) {
    const encErr = error as EncryptionError
    onError?.(encErr)
    console.error(`Failed to decrypt cookies for profile ${profileId}:`, encErr.message)
    return '[]'
  }
}

export function safeDecryptProxyCredential(
  encrypted: string | null,
  masterKey: Buffer,
  proxyId: string,
  type: 'username' | 'password',
  onError?: (err: EncryptionError) => void,
): string {
  if (!encrypted) return ''

  try {
    return decryptProxyCredential(encrypted, masterKey, proxyId, type)
  } catch (error) {
    const encErr = error as EncryptionError
    onError?.(encErr)
    console.error(`Failed to decrypt proxy ${type} for proxy ${proxyId}:`, encErr.message)
    return ''
  }
}

/**
 * Derive master encryption key from application secrets.
 * IMPORTANT: This must be deterministic and consistent across app restarts.
 * In production, consider:
 * - Storing in OS keychain
 * - Using app-level secrets from encrypted config
 * - Deriving from user password (if user auth exists)
 */
export function deriveMasterKey(appSecret: string, userId?: string): Buffer {
  const input = userId ? `${appSecret}|${userId}` : appSecret
  return createHash('sha256').update(input).digest()
}
