/**
 * Phase 15.A — MarketplaceManager tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Stub database before import so install() can succeed
vi.doMock('../../src/main/database', () => {
  let store: Record<string, any> = {}
  const db = {
    createWorkflow: (w: any) => { store[w.id] = { ...w, steps: JSON.stringify(w.steps) } },
    getWorkflow:    (id: string) => store[id] ?? null
  }
  return { Database: { getInstance: () => db } }
})

const { MarketplaceManager } = await import('../../src/main/marketplace')

describe('MarketplaceManager', () => {
  let mgr: InstanceType<typeof MarketplaceManager>

  beforeEach(() => {
    mgr = MarketplaceManager._reset()
  })

  it('list() returns all catalog entries', () => {
    const items = mgr.list()
    expect(items.length).toBeGreaterThan(0)
  })

  it('list() filters by category', () => {
    const social = mgr.list({ category: 'social' })
    expect(social.every((w) => w.category === 'social')).toBe(true)
  })

  it('list() filters by search query (name match)', () => {
    const results = mgr.list({ q: 'shopee' })
    expect(results.length).toBeGreaterThan(0)
    results.forEach((r) =>
      expect(
        r.name.toLowerCase().includes('shopee') ||
        r.description.toLowerCase().includes('shopee') ||
        r.tags.some((t) => t.includes('shopee'))
      ).toBe(true)
    )
  })

  it('list() filters by search query (tag match)', () => {
    const results = mgr.list({ q: 'warmup' })
    expect(results.some((r) => r.tags.includes('warmup'))).toBe(true)
  })

  it('list() returns empty array for unknown category filter', () => {
    const results = mgr.list({ category: 'finance' })
    expect(results).toEqual([])
  })

  it('get() returns correct entry by id', () => {
    const all = mgr.list()
    const first = all[0]
    const found = mgr.get(first.id)
    expect(found).not.toBeNull()
    expect(found?.id).toBe(first.id)
  })

  it('get() returns null for unknown id', () => {
    expect(mgr.get('does-not-exist')).toBeNull()
  })

  it('install() returns workflow row with steps', () => {
    const all = mgr.list()
    const entry = all[0]
    const result = mgr.install(entry.id)
    expect(result).not.toBeNull()
    expect(result.name).toBe(entry.name)
    expect(Array.isArray(result.steps)).toBe(true)
    // All step IDs should be freshly generated (not the same as originals)
    const originalIds = new Set((entry.steps ?? []).map((s: any) => s.id))
    result.steps.forEach((s: any) => expect(originalIds.has(s.id)).toBe(false))
  })

  it('install() respects custom name', () => {
    const all = mgr.list()
    const result = mgr.install(all[0].id, 'My Custom Name')
    expect(result.name).toBe('My Custom Name')
  })

  it('install() throws for unknown id', () => {
    expect(() => mgr.install('ghost-id')).toThrow(/not found/)
  })

  it('catalog items all have required fields', () => {
    mgr.list().forEach((w) => {
      expect(w.id).toBeTruthy()
      expect(w.name).toBeTruthy()
      expect(w.author).toBeTruthy()
      expect(w.category).toBeTruthy()
      expect(Array.isArray(w.tags)).toBe(true)
      expect(typeof w.stars).toBe('number')
      expect(typeof w.downloads).toBe('number')
    })
  })
})
