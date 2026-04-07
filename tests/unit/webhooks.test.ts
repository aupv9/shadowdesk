/**
 * Phase 15.C — WebhookManager tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { WebhookManager } from '../../src/main/webhooks'

function makeFiles() {
  const base = tmpdir()
  const ts = `${Date.now()}-${Math.random()}`
  return {
    hooksFile: join(base, `hooks-${ts}.json`),
    telegramFile: join(base, `telegram-${ts}.json`)
  }
}

async function freshMgr() {
  const { hooksFile, telegramFile } = makeFiles()
  return WebhookManager._reset(hooksFile, telegramFile)
}

describe('WebhookManager', () => {
  let mgr: WebhookManager

  beforeEach(async () => { mgr = await freshMgr() })

  it('starts with empty hooks list', async () => {
    expect(await mgr.listWebhooks()).toEqual([])
  })

  it('adds a webhook', async () => {
    const h = await mgr.addWebhook({ name: 'slack', url: 'https://hooks.slack.com/x', events: ['profile.launched'] })
    expect(h.id).toBeDefined()
    expect(h.enabled).toBe(true)
    const list = await mgr.listWebhooks()
    expect(list.length).toBe(1)
  })

  it('rejects empty name', async () => {
    await expect(mgr.addWebhook({ name: '', url: 'https://x.test', events: ['profile.launched'] })).rejects.toThrow(/name/)
  })

  it('rejects invalid URL', async () => {
    await expect(mgr.addWebhook({ name: 'x', url: 'not-a-url', events: ['profile.launched'] })).rejects.toThrow(/URL/)
  })

  it('rejects empty events', async () => {
    await expect(mgr.addWebhook({ name: 'x', url: 'https://x.test', events: [] })).rejects.toThrow(/event/)
  })

  it('removes a webhook', async () => {
    const h = await mgr.addWebhook({ name: 'a', url: 'https://x.test', events: ['profile.created'] })
    await mgr.removeWebhook(h.id)
    expect(await mgr.listWebhooks()).toEqual([])
  })

  it('toggles enabled', async () => {
    const h = await mgr.addWebhook({ name: 'a', url: 'https://x.test', events: ['profile.created'] })
    await mgr.updateWebhook(h.id, { enabled: false })
    const updated = (await mgr.listWebhooks())[0]
    expect(updated.enabled).toBe(false)
  })

  it('dispatch calls matching enabled hooks', async () => {
    const calls: string[] = []
    await mgr.addWebhook({ name: 'h1', url: 'https://a.test', events: ['profile.launched'] })
    await mgr.addWebhook({ name: 'h2', url: 'https://b.test', events: ['detection.completed'] })
    mgr.fetchImpl = async (url) => { calls.push(url); return { ok: true, status: 200 } }
    await mgr.dispatch('profile.launched', { profileId: 'p1', name: 'test' })
    expect(calls.length).toBe(1)
    expect(calls[0]).toBe('https://a.test')
  })

  it('dispatch skips disabled hooks', async () => {
    const calls: string[] = []
    const h = await mgr.addWebhook({ name: 'h1', url: 'https://a.test', events: ['profile.launched'] })
    await mgr.updateWebhook(h.id, { enabled: false })
    mgr.fetchImpl = async (url) => { calls.push(url); return { ok: true, status: 200 } }
    await mgr.dispatch('profile.launched', { profileId: 'p1' })
    expect(calls.length).toBe(0)
  })

  it('dispatch updates lastStatus on success', async () => {
    const h = await mgr.addWebhook({ name: 'h1', url: 'https://a.test', events: ['profile.launched'] })
    mgr.fetchImpl = async () => ({ ok: true, status: 200 })
    await mgr.dispatch('profile.launched', {})
    const list = await mgr.listWebhooks()
    expect(list[0].lastStatus).toBe(200)
    expect(list[0].lastTriggeredAt).toBeDefined()
  })

  it('dispatch records status 0 on network failure', async () => {
    const h = await mgr.addWebhook({ name: 'h1', url: 'https://a.test', events: ['profile.launched'] })
    mgr.fetchImpl = async () => { throw new Error('timeout') }
    await mgr.dispatch('profile.launched', {})
    const list = await mgr.listWebhooks()
    expect(list[0].lastStatus).toBe(0)
  })

  it('dispatch sends HMAC signature header when secret is set', async () => {
    const received: Record<string, string>[] = []
    await mgr.addWebhook({ name: 'h1', url: 'https://a.test', events: ['profile.created'], secret: 'mySecret' })
    mgr.fetchImpl = async (_url, init) => { received.push(init?.headers ?? {}); return { ok: true, status: 200 } }
    await mgr.dispatch('profile.created', {})
    expect(received[0]['X-Signature']).toMatch(/^sha256=/)
  })

  it('getTelegramConfig returns default when unconfigured', async () => {
    const cfg = await mgr.getTelegramConfig()
    expect(cfg.enabled).toBe(false)
    expect(cfg.botToken).toBe('')
  })

  it('saveTelegramConfig persists', async () => {
    await mgr.saveTelegramConfig({ enabled: true, botToken: 'bot123', chatId: '-100abc', events: ['license.expiring'] })
    const cfg = await mgr.getTelegramConfig()
    expect(cfg.enabled).toBe(true)
    expect(cfg.botToken).toBe('bot123')
  })

  it('dispatch fires Telegram when configured and event matches', async () => {
    const tgCalls: string[] = []
    await mgr.saveTelegramConfig({ enabled: true, botToken: 'T', chatId: 'C', events: ['license.expiring'] })
    mgr.fetchImpl = async (url) => { tgCalls.push(url); return { ok: true, status: 200 } }
    await mgr.dispatch('license.expiring', { daysLeft: 3 })
    expect(tgCalls.some((u) => u.includes('api.telegram.org'))).toBe(true)
  })
})
