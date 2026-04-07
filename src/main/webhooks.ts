/**
 * Phase 15.C — Outbound Webhooks & Telegram Alerts
 *
 * Persists webhook configs in a JSON file (same pattern as remote-nodes.ts).
 * On `dispatch(event, payload)` every enabled matching webhook is called via
 * HTTP POST with an HMAC-SHA256 signature header when a secret is configured.
 * Telegram alerts are dispatched separately via the Bot API sendMessage method.
 *
 * Pluggable `fetchImpl` allows tests to override HTTP calls.
 */

import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createHmac } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import type { WebhookConfig, TelegramConfig, CreateWebhookInput, WebhookEvent } from '../shared/types'

const WEBHOOKS_FILE = 'webhooks.json'
const TELEGRAM_FILE = 'telegram.json'

const DEFAULT_TELEGRAM: TelegramConfig = {
  enabled: false,
  botToken: '',
  chatId: '',
  events: []
}

export class WebhookManager {
  private static instance: WebhookManager | null = null
  private hooks: WebhookConfig[] = []
  private telegram: TelegramConfig = { ...DEFAULT_TELEGRAM }
  private hooksFile: string
  private telegramFile: string
  private loaded = false

  public fetchImpl: (url: string, init?: any) => Promise<{ ok: boolean; status: number }> =
    (typeof fetch !== 'undefined' ? (fetch as any) : async () => ({ ok: false, status: 0 }))

  private constructor(hooksFile?: string, telegramFile?: string) {
    const base = (() => { try { return app.getPath('userData') } catch { return process.cwd() } })()
    this.hooksFile = hooksFile ?? join(base, WEBHOOKS_FILE)
    this.telegramFile = telegramFile ?? join(base, TELEGRAM_FILE)
  }

  static getInstance(): WebhookManager {
    if (!this.instance) this.instance = new WebhookManager()
    return this.instance
  }

  static _reset(hooksFile?: string, telegramFile?: string): WebhookManager {
    this.instance = new WebhookManager(hooksFile, telegramFile)
    return this.instance
  }

  async load(): Promise<void> {
    if (this.loaded) return
    try {
      const raw = await fs.readFile(this.hooksFile, 'utf-8')
      this.hooks = JSON.parse(raw)
    } catch { this.hooks = [] }
    try {
      const raw = await fs.readFile(this.telegramFile, 'utf-8')
      this.telegram = JSON.parse(raw)
    } catch { this.telegram = { ...DEFAULT_TELEGRAM } }
    this.loaded = true
  }

  private async saveHooks(): Promise<void> {
    await fs.writeFile(this.hooksFile, JSON.stringify(this.hooks, null, 2), 'utf-8')
  }

  private async saveTelegram(): Promise<void> {
    await fs.writeFile(this.telegramFile, JSON.stringify(this.telegram, null, 2), 'utf-8')
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async listWebhooks(): Promise<WebhookConfig[]> {
    await this.load()
    return [...this.hooks]
  }

  async addWebhook(input: CreateWebhookInput): Promise<WebhookConfig> {
    await this.load()
    if (!input.name?.trim()) throw new Error('Webhook name is required')
    if (!input.url?.trim()) throw new Error('Webhook URL is required')
    try { new URL(input.url) } catch { throw new Error('Webhook URL is not a valid URL') }
    if (!input.events?.length) throw new Error('At least one event must be selected')

    const hook: WebhookConfig = {
      id: uuidv4(),
      name: input.name.trim(),
      url: input.url.trim(),
      events: input.events,
      secret: input.secret,
      enabled: true,
      createdAt: new Date().toISOString()
    }
    this.hooks.push(hook)
    await this.saveHooks()
    return hook
  }

  async updateWebhook(id: string, patch: Partial<WebhookConfig>): Promise<WebhookConfig | null> {
    await this.load()
    const idx = this.hooks.findIndex((h) => h.id === id)
    if (idx < 0) return null
    this.hooks[idx] = { ...this.hooks[idx], ...patch }
    await this.saveHooks()
    return this.hooks[idx]
  }

  async removeWebhook(id: string): Promise<void> {
    await this.load()
    this.hooks = this.hooks.filter((h) => h.id !== id)
    await this.saveHooks()
  }

  // ── Telegram ─────────────────────────────────────────────────────────────

  async getTelegramConfig(): Promise<TelegramConfig> {
    await this.load()
    return { ...this.telegram }
  }

  async saveTelegramConfig(cfg: TelegramConfig): Promise<void> {
    await this.load()
    this.telegram = { ...cfg }
    await this.saveTelegram()
  }

  // ── Dispatch ─────────────────────────────────────────────────────────────

  /**
   * Fire all enabled webhooks that subscribe to `event`.
   * Errors are swallowed per-hook so one failure doesn't block others.
   */
  async dispatch(event: WebhookEvent, payload: Record<string, any>): Promise<void> {
    await this.load()
    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() })
    const enabled = this.hooks.filter((h) => h.enabled && h.events.includes(event))

    await Promise.allSettled(
      enabled.map(async (hook) => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (hook.secret) {
          const sig = createHmac('sha256', hook.secret).update(body).digest('hex')
          headers['X-Signature'] = `sha256=${sig}`
        }
        try {
          const res = await this.fetchImpl(hook.url, { method: 'POST', headers, body })
          await this.updateWebhook(hook.id, {
            lastTriggeredAt: new Date().toISOString(),
            lastStatus: res.status
          })
        } catch (e: any) {
          await this.updateWebhook(hook.id, {
            lastTriggeredAt: new Date().toISOString(),
            lastStatus: 0
          })
        }
      })
    )

    // Telegram
    if (
      this.telegram.enabled &&
      this.telegram.botToken &&
      this.telegram.chatId &&
      this.telegram.events.includes(event)
    ) {
      const text = `🤖 *ShadowDesk Alert*\nEvent: \`${event}\`\n${Object.entries(payload)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')}`
      const tgUrl = `https://api.telegram.org/bot${this.telegram.botToken}/sendMessage`
      await this.fetchImpl(tgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: this.telegram.chatId, text, parse_mode: 'Markdown' })
      }).catch(() => {/* silent */})
    }
  }
}

export function getWebhookManager(): WebhookManager {
  return WebhookManager.getInstance()
}
