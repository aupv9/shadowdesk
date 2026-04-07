/**
 * Phase 14.A — Remote Browser Nodes tests.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { NodeManager } from '../../src/main/remote-nodes'

async function freshMgr(): Promise<NodeManager> {
  const file = join(tmpdir(), `nodes-${Date.now()}-${Math.random()}.json`)
  try { await fs.unlink(file) } catch {}
  return NodeManager._reset(file)
}

describe('NodeManager', () => {
  let mgr: NodeManager

  beforeEach(async () => { mgr = await freshMgr() })

  it('starts empty', async () => {
    expect(await mgr.list()).toEqual([])
  })

  it('adds and persists a node', async () => {
    const n = await mgr.add({ name: 'sgp-1', url: 'https://node.example.com:9222', capacity: 8 })
    expect(n.id).toBeDefined()
    expect(n.name).toBe('sgp-1')
    expect(n.capacity).toBe(8)
    expect(n.status).toBe('unknown')
    expect((await mgr.list()).length).toBe(1)
  })

  it('strips trailing slash from URL', async () => {
    const n = await mgr.add({ name: 'a', url: 'https://x.test/' })
    expect(n.url).toBe('https://x.test')
  })

  it('rejects empty name and invalid URL', async () => {
    await expect(mgr.add({ name: '', url: 'https://x.test' })).rejects.toThrow(/name/)
    await expect(mgr.add({ name: 'a', url: 'not-a-url' })).rejects.toThrow(/URL/)
  })

  it('removes a node', async () => {
    const n = await mgr.add({ name: 'a', url: 'https://x.test' })
    await mgr.remove(n.id)
    expect(await mgr.list()).toEqual([])
  })

  it('ping marks node online on success', async () => {
    const n = await mgr.add({ name: 'a', url: 'https://x.test' })
    mgr.fetchImpl = async () => ({ ok: true, status: 200 })
    const h = await mgr.ping(n.id)
    expect(h.status).toBe('online')
    const updated = (await mgr.list())[0]
    expect(updated.status).toBe('online')
    expect(updated.lastCheckedAt).toBeDefined()
  })

  it('ping marks node offline on network error', async () => {
    const n = await mgr.add({ name: 'a', url: 'https://x.test' })
    mgr.fetchImpl = async () => { throw new Error('ECONNREFUSED') }
    const h = await mgr.ping(n.id)
    expect(h.status).toBe('offline')
    expect(h.error).toMatch(/ECONNREFUSED/)
  })

  it('ping marks node error on non-2xx', async () => {
    const n = await mgr.add({ name: 'a', url: 'https://x.test' })
    mgr.fetchImpl = async () => ({ ok: false, status: 503 })
    const h = await mgr.ping(n.id)
    expect(h.status).toBe('error')
    expect(h.error).toBe('HTTP 503')
  })

  it('pickBestNode picks least-loaded online node', async () => {
    const a = await mgr.add({ name: 'a', url: 'https://a.test', capacity: 10 })
    const b = await mgr.add({ name: 'b', url: 'https://b.test', capacity: 10 })
    const c = await mgr.add({ name: 'c', url: 'https://c.test', capacity: 10 })
    await mgr.update(a.id, { status: 'online', activeProfiles: 5 })
    await mgr.update(b.id, { status: 'online', activeProfiles: 2 })
    await mgr.update(c.id, { status: 'offline', activeProfiles: 0 })
    const best = await mgr.pickBestNode()
    expect(best?.id).toBe(b.id)
  })

  it('pickBestNode returns null when none available', async () => {
    const a = await mgr.add({ name: 'a', url: 'https://a.test', capacity: 1 })
    await mgr.update(a.id, { status: 'online', activeProfiles: 1 })
    expect(await mgr.pickBestNode()).toBeNull()
  })

  it('persists across new instances', async () => {
    const file = join(tmpdir(), `nodes-${Date.now()}-persist.json`)
    try { await fs.unlink(file) } catch {}
    const m1 = NodeManager._reset(file)
    await m1.add({ name: 'a', url: 'https://x.test' })
    const m2 = NodeManager._reset(file)
    const list = await m2.list()
    expect(list.length).toBe(1)
    expect(list[0].name).toBe('a')
  })
})
