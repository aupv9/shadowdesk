/**
 * Unit tests for the proxy credential encryption service.
 *
 * Verifies:
 *  - Encrypted blobs carry the `enc:v1:` marker prefix.
 *  - Round-trip: encrypt → decrypt returns the original plaintext.
 *  - Same plaintext produces different ciphertexts each call (fresh IV).
 *  - Legacy plain-text values pass through `decryptCredential` unchanged.
 *  - Different proxy IDs derive different keys (salt isolation).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock electron + license modules so the credential service can derive a
// stable test machine ID without touching real network interfaces.
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/ghost-test') },
}))
vi.mock('../../src/main/license', () => ({
  getMachineId: () => 'test-machine-id-deadbeef',
}))

// Lazy import after mocks are in place
async function loadService() {
  const mod = await import('../../src/main/crypto/proxy-credential-service')
  mod._resetKeyCacheForTests()
  return mod
}

describe('proxy-credential-service', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('encrypts a password and decrypts it back', async () => {
    const svc = await loadService()
    const enc = svc.encryptCredential('my-secret-password', 'proxy-1', 'password')
    expect(enc).not.toBeNull()
    expect(svc.isEncryptedCredential(enc)).toBe(true)
    expect(enc).toMatch(/^enc:v1:/)

    const decrypted = svc.decryptCredential(enc, 'proxy-1', 'password')
    expect(decrypted).toBe('my-secret-password')
  })

  it('returns null for empty / undefined inputs', async () => {
    const svc = await loadService()
    expect(svc.encryptCredential('', 'p', 'password')).toBeNull()
    expect(svc.encryptCredential(undefined, 'p', 'password')).toBeNull()
    expect(svc.encryptCredential(null, 'p', 'password')).toBeNull()
  })

  it('returns empty string when decrypting empty input', async () => {
    const svc = await loadService()
    expect(svc.decryptCredential('', 'p', 'password')).toBe('')
    expect(svc.decryptCredential(null, 'p', 'password')).toBe('')
  })

  it('returns legacy plaintext unchanged on decrypt', async () => {
    const svc = await loadService()
    // No `enc:v1:` prefix → assumed to be legacy plain-text
    expect(svc.decryptCredential('plain-text-old', 'p', 'password')).toBe('plain-text-old')
  })

  it('produces different ciphertexts for the same plaintext (fresh IV per call)', async () => {
    const svc = await loadService()
    const a = svc.encryptCredential('same', 'proxy-1', 'password')
    const b = svc.encryptCredential('same', 'proxy-1', 'password')
    expect(a).not.toBe(b)
    expect(svc.decryptCredential(a, 'proxy-1', 'password')).toBe('same')
    expect(svc.decryptCredential(b, 'proxy-1', 'password')).toBe('same')
  })

  it('isolates keys per proxy ID (different salt)', async () => {
    const svc = await loadService()
    const enc = svc.encryptCredential('shared-pass', 'proxy-A', 'password')
    // Decrypting with the wrong proxy ID should fail (return empty via safe wrapper)
    const wrongId = svc.decryptCredential(enc, 'proxy-B', 'password')
    expect(wrongId).toBe('')
  })

  it('does not double-wrap an already-encrypted value', async () => {
    const svc = await loadService()
    const enc = svc.encryptCredential('hello', 'proxy-1', 'password')!
    const reEnc = svc.encryptCredential(enc, 'proxy-1', 'password')
    expect(reEnc).toBe(enc)
  })

  it('username and password use different salts (cross-type isolation)', async () => {
    const svc = await loadService()
    const enc = svc.encryptCredential('val', 'proxy-1', 'username')
    // Decrypting a username blob with type=password should fail
    expect(svc.decryptCredential(enc, 'proxy-1', 'password')).toBe('')
    // But works with the correct type
    expect(svc.decryptCredential(enc, 'proxy-1', 'username')).toBe('val')
  })
})
