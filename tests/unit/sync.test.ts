/**
 * Unit tests for src/main/sync.ts — encrypt / decrypt functions.
 *
 * AES-256-GCM with scrypt key derivation and per-user salt.
 * Buffer format: [iv 12 bytes] [authTag 16 bytes] [encrypted data]
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))
vi.mock('../../src/main/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('../../src/main/database', () => ({
  Database: { getInstance: () => ({}) }
}))
vi.mock('../../src/main/auth', () => ({
  isAuthenticated: vi.fn(() => true),
  getCurrentUser: vi.fn(async () => ({ id: 'user-123' }))
}))
vi.mock('../../src/main/license', () => ({
  getCurrentLicense: vi.fn(async () => ({ plan: 'professional' }))
}))

import { encrypt, decrypt } from '../../src/main/sync'

// ── Helpers ──────────────────────────────────────────────────────────────────

const PASSWORD = 's3cure-p@ssw0rd!'
const USER_ID = 'user-abc-123'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('sync — encrypt / decrypt', () => {
  // ── Round-trip ───────────────────────────────────────────────────────────

  it('round-trip: encrypt then decrypt returns original data', () => {
    const plaintext = 'Hello, Ghost Browser!'
    const bundle = encrypt(plaintext, PASSWORD, USER_ID)
    const result = decrypt(bundle, PASSWORD, USER_ID)
    expect(result).toBe(plaintext)
  })

  // ── Different users ──────────────────────────────────────────────────────

  it('different userId produces different ciphertext for same data and password', () => {
    const plaintext = 'identical payload'
    const bundleA = encrypt(plaintext, PASSWORD, 'user-alice')
    const bundleB = encrypt(plaintext, PASSWORD, 'user-bob')

    // Ciphertexts must differ (different derived keys)
    expect(bundleA.equals(bundleB)).toBe(false)

    // Each decrypts correctly with its own userId
    expect(decrypt(bundleA, PASSWORD, 'user-alice')).toBe(plaintext)
    expect(decrypt(bundleB, PASSWORD, 'user-bob')).toBe(plaintext)
  })

  // ── Random IV ────────────────────────────────────────────────────────────

  it('random IV: same inputs encrypted twice produce different ciphertext', () => {
    const plaintext = 'deterministic test'
    const bundleA = encrypt(plaintext, PASSWORD, USER_ID)
    const bundleB = encrypt(plaintext, PASSWORD, USER_ID)

    expect(bundleA.equals(bundleB)).toBe(false)

    // Both still decrypt to the same plaintext
    expect(decrypt(bundleA, PASSWORD, USER_ID)).toBe(plaintext)
    expect(decrypt(bundleB, PASSWORD, USER_ID)).toBe(plaintext)
  })

  // ── Wrong password ───────────────────────────────────────────────────────

  it('wrong password throws on decrypt', () => {
    const bundle = encrypt('secret', PASSWORD, USER_ID)
    expect(() => decrypt(bundle, 'wrong-password', USER_ID)).toThrow()
  })

  // ── Wrong userId ─────────────────────────────────────────────────────────

  it('wrong userId throws on decrypt (no legacy salt match)', () => {
    const bundle = encrypt('secret', PASSWORD, USER_ID)
    // Neither per-user salt for wrong-user nor legacy salt will match
    expect(() => decrypt(bundle, PASSWORD, 'wrong-user-id')).toThrow()
  })

  // ── Buffer format ────────────────────────────────────────────────────────

  it('output is a Buffer of length >= 28 (12 IV + 16 tag + data)', () => {
    const bundle = encrypt('x', PASSWORD, USER_ID)
    expect(Buffer.isBuffer(bundle)).toBe(true)
    // 12 (IV) + 16 (authTag) + at least 1 byte of encrypted data
    expect(bundle.length).toBeGreaterThanOrEqual(28 + 1)
  })

  it('buffer length grows with data size', () => {
    const small = encrypt('a', PASSWORD, USER_ID)
    const large = encrypt('a'.repeat(1000), PASSWORD, USER_ID)
    expect(large.length).toBeGreaterThan(small.length)
  })

  // ── Empty string ─────────────────────────────────────────────────────────

  it('encrypt/decrypt empty string works', () => {
    const bundle = encrypt('', PASSWORD, USER_ID)
    expect(Buffer.isBuffer(bundle)).toBe(true)
    // Empty plaintext still has IV + authTag = 28 bytes minimum
    expect(bundle.length).toBeGreaterThanOrEqual(28)
    const result = decrypt(bundle, PASSWORD, USER_ID)
    expect(result).toBe('')
  })

  // ── Unicode data ─────────────────────────────────────────────────────────

  it('encrypt/decrypt Unicode (Vietnamese text) works', () => {
    const vietnamese = 'Xin chào! Đây là trình duyệt Ghost. Tôi yêu Việt Nam 🇻🇳'
    const bundle = encrypt(vietnamese, PASSWORD, USER_ID)
    const result = decrypt(bundle, PASSWORD, USER_ID)
    expect(result).toBe(vietnamese)
  })

  it('encrypt/decrypt mixed Unicode and special characters', () => {
    const mixed = '日本語テスト • 한국어 • العربية • emoji: 🎭🔐'
    const bundle = encrypt(mixed, PASSWORD, USER_ID)
    expect(decrypt(bundle, PASSWORD, USER_ID)).toBe(mixed)
  })

  // ── Large data ───────────────────────────────────────────────────────────

  it('encrypt/decrypt 100KB of data works', () => {
    const largeData = 'A'.repeat(100 * 1024) // 100KB
    const bundle = encrypt(largeData, PASSWORD, USER_ID)
    const result = decrypt(bundle, PASSWORD, USER_ID)
    expect(result).toBe(largeData)
    expect(result.length).toBe(100 * 1024)
  })

  // ── IV is exactly 12 bytes ───────────────────────────────────────────────

  it('first 12 bytes of output are the IV', () => {
    const bundleA = encrypt('data', PASSWORD, USER_ID)
    const bundleB = encrypt('data', PASSWORD, USER_ID)

    const ivA = bundleA.subarray(0, 12)
    const ivB = bundleB.subarray(0, 12)

    // Random IVs should differ
    expect(ivA.equals(ivB)).toBe(false)
    // IV should be exactly 12 bytes
    expect(ivA.length).toBe(12)
  })

  // ── Tampered ciphertext ──────────────────────────────────────────────────

  it('tampered ciphertext throws on decrypt (GCM integrity check)', () => {
    const bundle = encrypt('important data', PASSWORD, USER_ID)
    // Flip a byte in the encrypted payload (after IV + authTag)
    const tampered = Buffer.from(bundle)
    if (tampered.length > 28) {
      tampered[28] ^= 0xff
    }
    expect(() => decrypt(tampered, PASSWORD, USER_ID)).toThrow()
  })

  it('tampered auth tag throws on decrypt', () => {
    const bundle = encrypt('important data', PASSWORD, USER_ID)
    const tampered = Buffer.from(bundle)
    // Flip a byte in the auth tag (bytes 12-27)
    tampered[15] ^= 0xff
    expect(() => decrypt(tampered, PASSWORD, USER_ID)).toThrow()
  })

  // ── Legacy salt fallback ─────────────────────────────────────────────────

  it('decrypt falls back to legacy salt for bundles encrypted with it', () => {
    // Manually encrypt with the legacy salt to simulate old bundles
    const { createCipheriv, scryptSync, randomBytes } = require('crypto')
    const LEGACY_SALT = 'ghost-browser-sync-salt-v1'
    const plaintext = 'legacy encrypted data'

    const key = scryptSync(PASSWORD, LEGACY_SALT, 32)
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    const legacyBundle = Buffer.concat([iv, authTag, encrypted])

    // decrypt should fall back to legacy salt successfully
    const result = decrypt(legacyBundle, PASSWORD, USER_ID)
    expect(result).toBe(plaintext)
  })

  // ── JSON payload round-trip (real-world usage) ───────────────────────────

  it('handles JSON payload round-trip (simulating profile sync)', () => {
    const payload = JSON.stringify({
      profiles: [
        { id: 'p1', name: 'Profile 1', fingerprint: { preset: 'win10-chrome120' } },
        { id: 'p2', name: 'Profile 2', fingerprint: { preset: 'mac-sonoma-chrome121' } }
      ],
      exported_at: '2026-01-01T00:00:00.000Z',
      version: 1
    })

    const bundle = encrypt(payload, PASSWORD, USER_ID)
    const result = decrypt(bundle, PASSWORD, USER_ID)
    const parsed = JSON.parse(result)

    expect(parsed.profiles).toHaveLength(2)
    expect(parsed.profiles[0].id).toBe('p1')
    expect(parsed.version).toBe(1)
  })
})
