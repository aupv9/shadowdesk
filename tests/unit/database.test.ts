import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdtempSync } from 'fs'

// Create a fresh temp dir per test to prevent state leakage
function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'ghost-db-test-'))
}

// Import a fresh Database instance per test (bypassing singleton)
async function createFreshDb() {
  vi.resetModules()
  const tempDir = makeTempDir()
  vi.doMock('electron', () => ({
    app: { getPath: vi.fn(() => tempDir) }
  }))
  const { Database } = await import('../../src/main/database')
  // Bypass singleton for testing
  const db = new (Database as any)()
  await db.initialize()
  return db
}

describe('Database — Profile CRUD', () => {
  let db: any

  beforeEach(async () => {
    db = await createFreshDb()
  })

  it('returns empty profiles initially', () => {
    expect(db.getAllProfiles()).toEqual([])
  })

  it('creates and retrieves a profile', () => {
    db.createProfile({
      id: 'p1',
      name: 'Test Profile',
      fingerprint: { preset: 'win10-chrome120' },
      user_data_path: '/tmp/p1'
    })
    const profiles = db.getAllProfiles()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].name).toBe('Test Profile')
  })

  it('getProfile returns null for unknown id', () => {
    expect(db.getProfile('nonexistent')).toBeNull()
  })

  it('getProfile returns the profile with columns', () => {
    db.createProfile({ id: 'p2', name: 'P2', fingerprint: {}, user_data_path: '/tmp/p2' })
    const p = db.getProfile('p2')
    expect(p).not.toBeNull()
    expect(p.name).toBe('P2')
  })

  it('updateProfile updates allowed fields', () => {
    db.createProfile({ id: 'p3', name: 'Old Name', fingerprint: {}, user_data_path: '/tmp/p3' })
    db.updateProfile('p3', { name: 'New Name', notes: 'hello' })
    const p = db.getProfile('p3')
    expect(p.name).toBe('New Name')
    expect(p.notes).toBe('hello')
  })

  it('updateProfile ignores non-whitelisted fields (security)', () => {
    db.createProfile({ id: 'p4', name: 'Safe', fingerprint: {}, user_data_path: '/tmp/p4' })
    // Malicious column name — must be silently ignored
    expect(() => db.updateProfile('p4', { 'id; DROP TABLE profiles; --': 'evil' })).not.toThrow()
    const p = db.getProfile('p4')
    expect(p.name).toBe('Safe')
    // Table still intact
    expect(db.getAllProfiles()).toHaveLength(1)
  })

  it('deleteProfile archives instead of destroying', () => {
    db.createProfile({ id: 'p5', name: 'To Delete', fingerprint: {}, user_data_path: '/tmp/p5' })
    db.deleteProfile('p5')
    // getAllProfiles excludes archived
    expect(db.getAllProfiles()).toHaveLength(0)
    // But getProfile still finds it
    const p = db.getProfile('p5')
    expect(p.status).toBe('archived')
  })

  it('cloneProfile copies the source with a new id', () => {
    db.createProfile({ id: 'src', name: 'Source', fingerprint: { preset: 'linux-ubuntu-chrome120' }, user_data_path: '/tmp/src' })
    db.cloneProfile({
      id: 'clone1',
      sourceId: 'src',
      name: 'Source (Copy)',
      fingerprint: { preset: 'linux-ubuntu-chrome120' },
      user_data_path: '/tmp/clone1'
    })
    const clone = db.getProfile('clone1')
    expect(clone.name).toBe('Source (Copy)')
  })

  it('updateProfileLastUsed sets last_used_at', () => {
    db.createProfile({ id: 'p6', name: 'P6', fingerprint: {}, user_data_path: '/tmp/p6' })
    expect(db.getProfile('p6').last_used_at).toBeFalsy()
    db.updateProfileLastUsed('p6')
    expect(db.getProfile('p6').last_used_at).toBeTruthy()
  })
})

describe('Database — Cookie methods', () => {
  let db: any

  beforeEach(async () => {
    db = await createFreshDb()
    db.createProfile({ id: 'cp1', name: 'Cookie Profile', fingerprint: {}, user_data_path: '/tmp/cp1' })
  })

  it('getCookies returns empty array string by default', () => {
    expect(db.getCookies('cp1')).toBe('[]')
  })

  it('updateCookies stores and retrieves cookies', () => {
    const cookies = JSON.stringify([{ name: 'session', value: 'abc123' }])
    db.updateCookies('cp1', cookies)
    expect(db.getCookies('cp1')).toBe(cookies)
  })

  it('getCookies returns "[]" for non-existent profile', () => {
    expect(db.getCookies('nope')).toBe('[]')
  })
})

describe('Database — Group CRUD', () => {
  let db: any

  beforeEach(async () => {
    db = await createFreshDb()
  })

  it('returns empty groups initially', () => {
    expect(db.getAllGroups()).toEqual([])
  })

  it('creates and retrieves a group', () => {
    db.createGroup({ id: 'g1', name: 'Work', color: '#3b82f6' })
    const groups = db.getAllGroups()
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Work')
    expect(groups[0].color).toBe('#3b82f6')
  })

  it('deleteGroup removes the group and NULLs profile group_id', () => {
    db.createGroup({ id: 'g2', name: 'Temp' })
    db.createProfile({ id: 'pg1', name: 'P', fingerprint: {}, user_data_path: '/tmp/pg1' })
    db.updateProfileGroup('pg1', 'g2')
    db.deleteGroup('g2')
    expect(db.getAllGroups()).toHaveLength(0)
    expect(db.getProfile('pg1').group_id).toBeNull()
  })

  it('updateProfileGroup sets and clears group_id', () => {
    db.createGroup({ id: 'g3', name: 'G3' })
    db.createProfile({ id: 'pgx', name: 'PGX', fingerprint: {}, user_data_path: '/tmp/pgx' })
    db.updateProfileGroup('pgx', 'g3')
    expect(db.getProfile('pgx').group_id).toBe('g3')
    db.updateProfileGroup('pgx', null)
    expect(db.getProfile('pgx').group_id).toBeNull()
  })
})

describe('Database — Proxy CRUD', () => {
  let db: any

  beforeEach(async () => {
    db = await createFreshDb()
  })

  it('returns empty proxies initially', () => {
    expect(db.getAllProxies()).toEqual([])
  })

  it('creates and retrieves a proxy', () => {
    db.createProxy({ id: 'px1', name: 'My Proxy', type: 'http', host: 'proxy.example.com', port: 8080 })
    const proxies = db.getAllProxies()
    expect(proxies).toHaveLength(1)
    expect(proxies[0].host).toBe('proxy.example.com')
    expect(proxies[0].port).toBe(8080)
  })

  it('updateProxyHealth sets is_healthy and latency_ms', () => {
    db.createProxy({ id: 'px2', name: 'Fast', type: 'socks5', host: 'fast.proxy', port: 1080 })
    db.updateProxyHealth('px2', 42, true)
    const p = db.getAllProxies().find((x: any) => x.id === 'px2')
    expect(p.is_healthy).toBe(1)
    expect(p.latency_ms).toBe(42)
  })

  it('deleteProxy removes it permanently', () => {
    db.createProxy({ id: 'px3', name: 'Del', type: 'http', host: 'del.proxy', port: 3128 })
    db.deleteProxy('px3')
    expect(db.getAllProxies()).toHaveLength(0)
  })

  // ── Credential encryption (P0 security fix) ─────────────────────────────

  it('encrypts proxy credentials at rest and decrypts on read', () => {
    db.createProxy({
      id: 'px-enc',
      name: 'Auth',
      type: 'http',
      host: '1.2.3.4',
      port: 8080,
      username: 'alice',
      password: 'super-secret',
    })

    // Round-trip via the public CRUD API returns plain text
    const fetched = db.getProxy('px-enc')
    expect(fetched.username).toBe('alice')
    expect(fetched.password).toBe('super-secret')

    // But the raw storage layer holds an `enc:v1:` ciphertext
    const raw = db.queryAll
      ? (db as any).queryAll('SELECT username, password FROM proxies WHERE id = ?', ['px-enc'])[0]
      : null
    if (raw) {
      expect(raw.username).toMatch(/^enc:v1:/)
      expect(raw.password).toMatch(/^enc:v1:/)
    }
  })

  it('handles a proxy with no credentials', () => {
    db.createProxy({ id: 'px-noauth', name: 'Open', type: 'http', host: 'open.proxy', port: 80 })
    const fetched = db.getProxy('px-noauth')
    expect(fetched.username).toBeNull()
    expect(fetched.password).toBeNull()
  })

  it('encryptLegacyProxyCredentials migrates plain-text rows in place', () => {
    // Manually insert a row with plain-text credentials, simulating
    // a database created before the encryption upgrade.
    ;(db as any).run(
      `INSERT INTO proxies (id, name, type, host, port, username, password)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['px-legacy', 'Legacy', 'http', 'old.proxy', 8080, 'olduser', 'oldpass'],
    )

    const result = db.encryptLegacyProxyCredentials()
    expect(result.migrated).toBe(1)

    // After migration, public reads still return plain text…
    const fetched = db.getProxy('px-legacy')
    expect(fetched.username).toBe('olduser')
    expect(fetched.password).toBe('oldpass')

    // …but the underlying storage is now encrypted.
    const raw = (db as any).queryAll(
      'SELECT username, password FROM proxies WHERE id = ?',
      ['px-legacy'],
    )[0]
    expect(raw.username).toMatch(/^enc:v1:/)
    expect(raw.password).toMatch(/^enc:v1:/)

    // Re-running migration is a no-op
    expect(db.encryptLegacyProxyCredentials().migrated).toBe(0)
  })
})
