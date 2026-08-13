/**
 * Persistence added for detection Layers 1 and 3.
 *
 * These paths were written alongside the rules and had no coverage: the hash
 * store that R11/R12 compare against, the canary history that attribution
 * reads, and the dual-score columns on detection_tests. A `LIMIT ?` bound
 * parameter in particular is worth pinning — sql.js is not better-sqlite3.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdtempSync } from 'fs'

async function createFreshDb() {
  vi.resetModules()
  const tempDir = mkdtempSync(join(tmpdir(), 'shadowdesk-detection-'))
  vi.doMock('electron', () => ({ app: { getPath: vi.fn(() => tempDir) } }))
  const { Database } = await import('../../src/main/database')
  const db = new (Database as any)()
  await db.initialize()
  return db
}

function seedProfile(db: any, id: string) {
  db.createProfile({
    id,
    name: `Profile ${id}`,
    fingerprint: {},
    user_data_path: `/tmp/${id}`
  })
}

describe('fingerprint hash store (R11/R12 baseline)', () => {
  let db: any
  beforeEach(async () => {
    db = await createFreshDb()
  })

  it('returns null before a profile has ever been measured', () => {
    expect(db.getFingerprintHashes('never-seen')).toBeNull()
  })

  it('round-trips a set of hashes', () => {
    seedProfile(db, 'p1')
    db.saveFingerprintHashes('p1', { canvas: 'c1', webgl: 'w1', audio: 'a1' })

    const got = db.getFingerprintHashes('p1')
    expect(got.canvas).toBe('c1')
    expect(got.webgl).toBe('w1')
    expect(got.audio).toBe('a1')
  })

  it('overwrites rather than accumulating rows per profile', () => {
    seedProfile(db, 'p1')
    db.saveFingerprintHashes('p1', { canvas: 'first', webgl: 'w', audio: 'a' })
    db.saveFingerprintHashes('p1', { canvas: 'second', webgl: 'w', audio: 'a' })

    expect(db.getFingerprintHashes('p1').canvas).toBe('second')
    expect(db.getOtherFingerprintHashes('nobody')).toHaveLength(1)
  })

  it('excludes the subject profile from the uniqueness comparison', () => {
    seedProfile(db, 'p1')
    seedProfile(db, 'p2')
    db.saveFingerprintHashes('p1', { canvas: 'c1', webgl: 'w1', audio: 'a1' })
    db.saveFingerprintHashes('p2', { canvas: 'c2', webgl: 'w2', audio: 'a2' })

    const others = db.getOtherFingerprintHashes('p1')
    expect(others).toHaveLength(1)
    expect(others[0].profile_id).toBe('p2')
  })
})

describe('canary history', () => {
  let db: any
  beforeEach(async () => {
    db = await createFreshDb()
    seedProfile(db, 'p1')
    seedProfile(db, 'p2')
  })

  const save = (over: Partial<Record<string, any>> = {}) =>
    db.saveCanaryResult({
      id: `c-${Math.random()}`,
      profileId: 'p1',
      proxyId: 'x1',
      url: 'https://canary.example.com/',
      verdict: 'passed',
      detail: 'HTTP 200',
      testedAt: new Date().toISOString(),
      ...over
    })

  it('starts empty', () => {
    expect(db.getCanaryHistory()).toEqual([])
  })

  it('round-trips a verdict with its proxy pairing', () => {
    save({ verdict: 'blocked', proxyId: 'x9' })
    const [row] = db.getCanaryHistory()

    expect(row.profileId).toBe('p1')
    expect(row.proxyId).toBe('x9')
    expect(row.verdict).toBe('blocked')
  })

  it('keeps a null proxy for a direct connection rather than dropping the row', () => {
    save({ proxyId: null })
    expect(db.getCanaryHistory()[0].proxyId).toBeNull()
  })

  it('honours the bound LIMIT parameter', () => {
    for (let i = 0; i < 5; i++) save({ testedAt: `2026-08-13T00:0${i}:00Z` })
    expect(db.getCanaryHistory(3)).toHaveLength(3)
    expect(db.getCanaryHistory()).toHaveLength(5)
  })

  it('returns newest first, which is what attribution samples', () => {
    save({ testedAt: '2026-08-13T00:00:00Z', verdict: 'blocked' })
    save({ testedAt: '2026-08-13T09:00:00Z', verdict: 'passed' })
    expect(db.getCanaryHistory()[0].verdict).toBe('passed')
  })
})

describe('detection_tests dual scores', () => {
  let db: any
  beforeEach(async () => {
    db = await createFreshDb()
    seedProfile(db, 'p1')
  })

  const base = {
    id: 'r1',
    profileId: 'p1',
    profileName: 'Profile p1',
    testedAt: new Date().toISOString(),
    overallScore: 91,
    vectors: [{ name: 'navigator.webdriver', category: 'Automation', passed: true }],
    status: 'passed'
  }

  it('persists both scores and the proxy the run used', () => {
    db.saveDetectionTestResult({ ...base, injectionScore: 91, riskScore: 40, proxyId: 'x1' })
    const [row] = db.getDetectionTestResults('p1')

    expect(row.injectionScore).toBe(91)
    expect(row.riskScore).toBe(40)
    expect(row.proxyId).toBe('x1')
  })

  it('falls back to the legacy score when only one number was produced', () => {
    db.saveDetectionTestResult(base)
    const [row] = db.getDetectionTestResults('p1')

    expect(row.injectionScore).toBe(91)
    // Undefined, not 0 — a run without risk vectors has no risk score, and
    // rendering 0% would read as "caught by everything".
    expect(row.riskScore).toBeUndefined()
  })
})
