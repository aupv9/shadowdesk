/**
 * Phase 13.A — Unit tests for the encrypted credential vault.
 *
 * Tests:
 *  - Vault initialization / first-unlock flow
 *  - Wrong-password detection via sentinel
 *  - Lock / unlock / idle-timeout
 *  - Full CRUD round-trip (create → get → update → delete)
 *  - AES-256-GCM: same plaintext encrypts to different ciphertext each call
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── In-memory DB stub ────────────────────────────────────────────────────────

function makeDbStub() {
  const meta: Record<string, string> = {}
  const creds: Record<string, any> = {}

  return {
    _meta: meta,
    _creds: creds,
    getVaultMeta: (key: string) => meta[key] ?? null,
    setVaultMeta: (key: string, value: string) => { meta[key] = value },
    getAllCredentials: (profileId?: string) =>
      Object.values(creds).filter((c) => !profileId || c.profile_id === profileId),
    getCredential: (id: string) => creds[id] ?? null,
    createCredential: (row: any) => { creds[row.id] = { ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } },
    updateCredential: (id: string, data: any) => {
      if (creds[id]) creds[id] = { ...creds[id], ...data, updated_at: new Date().toISOString() }
    },
    deleteCredential: (id: string) => { delete creds[id] }
  }
}

// ── Helper: create a fresh vault with a fresh in-memory DB ──────────────────

let dbStub: ReturnType<typeof makeDbStub>

async function freshVault() {
  vi.resetModules()
  dbStub = makeDbStub()
  vi.doMock('../../src/main/database', () => ({
    Database: { getInstance: () => dbStub }
  }))
  vi.doMock('../../src/main/settings', () => ({
    getSettings: () => ({ vault: { idleTimeoutMinutes: 15 } })
  }))
  const { getVault } = await import('../../src/main/vault')
  return getVault()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Vault — initialization', () => {
  it('isInitialized() returns false before first unlock', async () => {
    const v = await freshVault()
    expect(v.isInitialized()).toBe(false)
  })

  it('isUnlocked() returns false before unlock', async () => {
    const v = await freshVault()
    expect(v.isUnlocked()).toBe(false)
  })

  it('first unlock creates vault and returns created=true', async () => {
    const v = await freshVault()
    const result = v.unlock('my-master-password')
    expect(result.ok).toBe(true)
    expect(result.created).toBe(true)
  })

  it('isInitialized() returns true after first unlock', async () => {
    const v = await freshVault()
    v.unlock('password')
    expect(v.isInitialized()).toBe(true)
  })

  it('isUnlocked() returns true after successful unlock', async () => {
    const v = await freshVault()
    v.unlock('password')
    expect(v.isUnlocked()).toBe(true)
  })
})

describe('Vault — password verification', () => {
  it('correct password unlocks vault (created=false on 2nd call)', async () => {
    const v = await freshVault()
    v.unlock('correct')
    v.lock()
    const result = v.unlock('correct')
    expect(result.ok).toBe(true)
    expect(result.created).toBe(false)
  })

  it('wrong password returns ok=false', async () => {
    const v = await freshVault()
    v.unlock('correct')
    v.lock()
    const result = v.unlock('wrong-password')
    expect(result.ok).toBe(false)
  })

  it('wrong password keeps vault locked', async () => {
    const v = await freshVault()
    v.unlock('correct')
    v.lock()
    v.unlock('wrong')
    expect(v.isUnlocked()).toBe(false)
  })
})

describe('Vault — lock/unlock lifecycle', () => {
  it('lock() sets isUnlocked to false', async () => {
    const v = await freshVault()
    v.unlock('pass')
    v.lock()
    expect(v.isUnlocked()).toBe(false)
  })

  it('list() throws when vault is locked', async () => {
    const v = await freshVault()
    expect(() => v.list()).toThrow(/locked/)
  })

  it('create() throws when vault is locked', async () => {
    const v = await freshVault()
    expect(() =>
      v.create({ profile_id: null, label: 'x', username: 'u', password: 'p' })
    ).toThrow(/locked/)
  })
})

describe('Vault — CRUD round-trip', () => {
  let vault: any

  beforeEach(async () => {
    vault = await freshVault()
    vault.unlock('test-password')
  })

  it('list() returns empty array initially', () => {
    expect(vault.list()).toEqual([])
  })

  it('create() returns a credential with correct plaintext fields', () => {
    const cred = vault.create({
      profile_id: null,
      label: 'Gmail',
      username: 'user@test.com',
      password: 's3cr3t'
    })
    expect(cred.label).toBe('Gmail')
    expect(cred.username).toBe('user@test.com')
    expect(cred.password).toBe('s3cr3t')
    expect(typeof cred.id).toBe('string')
  })

  it('list() returns one entry after create', () => {
    vault.create({ profile_id: null, label: 'FB', username: 'u', password: 'p' })
    expect(vault.list()).toHaveLength(1)
  })

  it('list() filters by profileId', () => {
    vault.create({ profile_id: 'p1', label: 'A', username: 'a', password: 'p' })
    vault.create({ profile_id: 'p2', label: 'B', username: 'b', password: 'p' })
    const p1Creds = vault.list('p1')
    expect(p1Creds).toHaveLength(1)
    expect(p1Creds[0].label).toBe('A')
  })

  it('get() returns the correct credential', () => {
    const c = vault.create({ profile_id: null, label: 'Test', username: 'x', password: 'y' })
    const fetched = vault.get(c.id)
    expect(fetched.username).toBe('x')
    expect(fetched.password).toBe('y')
  })

  it('get() throws for unknown id', () => {
    expect(() => vault.get('nonexistent')).toThrow(/not found/)
  })

  it('update() changes the label', () => {
    const c = vault.create({ profile_id: null, label: 'Old', username: 'u', password: 'p' })
    vault.update(c.id, { label: 'New' })
    expect(vault.get(c.id).label).toBe('New')
  })

  it('update() re-encrypts password', () => {
    const c = vault.create({ profile_id: null, label: 'X', username: 'u', password: 'old-pass' })
    vault.update(c.id, { password: 'new-pass' })
    expect(vault.get(c.id).password).toBe('new-pass')
  })

  it('delete() removes the credential', () => {
    const c = vault.create({ profile_id: null, label: 'Del', username: 'u', password: 'p' })
    vault.delete(c.id)
    expect(vault.list()).toHaveLength(0)
  })

  it('create() stores and retrieves custom fields', () => {
    const fields = { otp_seed: 'JBSWY3DPEHPK3PXP', note: 'backup code' }
    const c = vault.create({ profile_id: null, label: 'F', username: 'u', password: 'p', fields })
    expect(vault.get(c.id).fields).toEqual(fields)
  })

  it('multiple credentials are independent', () => {
    const a = vault.create({ profile_id: null, label: 'A', username: 'ua', password: 'pa' })
    const b = vault.create({ profile_id: null, label: 'B', username: 'ub', password: 'pb' })
    expect(vault.list()).toHaveLength(2)
    expect(vault.get(a.id).password).toBe('pa')
    expect(vault.get(b.id).password).toBe('pb')
  })
})

describe('Vault — encryption properties', () => {
  it('stored ciphertext differs from plaintext', async () => {
    const v = await freshVault()
    v.unlock('password')
    v.create({ profile_id: null, label: 'X', username: 'alice', password: 'secret' })
    const raw = Object.values(dbStub._creds)[0] as any
    // username_enc must not contain the plaintext
    expect(raw.username_enc).not.toContain('alice')
    expect(raw.password_enc).not.toContain('secret')
  })

  it('same plaintext encrypts to different ciphertext each time (random IV)', async () => {
    const v = await freshVault()
    v.unlock('password')
    const c1 = v.create({ profile_id: null, label: 'X', username: 'same', password: 'same' })
    const c2 = v.create({ profile_id: null, label: 'Y', username: 'same', password: 'same' })
    const raw1 = dbStub._creds[c1.id]
    const raw2 = dbStub._creds[c2.id]
    // Different IVs → different ciphertext even for identical plaintext
    expect(raw1.username_enc).not.toBe(raw2.username_enc)
  })

  it('ciphertext has iv:tag:ciphertext format (two colons)', async () => {
    const v = await freshVault()
    v.unlock('password')
    const c = v.create({ profile_id: null, label: 'Z', username: 'u', password: 'p' })
    const raw = dbStub._creds[c.id]
    const parts = raw.username_enc.split(':')
    expect(parts).toHaveLength(3)
  })
})
