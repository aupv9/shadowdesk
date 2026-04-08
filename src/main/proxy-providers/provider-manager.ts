import { v4 as uuidv4 } from 'uuid'
import type {
  GeneratedProxy,
  ProxyGenerationOptions,
  ProxyProviderAccount,
  ProxyProviderAccountView,
  ProxyProviderCredentialsInput,
  ProxyProviderTestResult,
  ProxyProviderType,
  ProxyProviderUsage,
} from '../../shared/types'
import { Database } from '../database'
import { ProviderAdapter } from './base-adapter'
import { SmartproxyAdapter } from './adapters/smartproxy'
import { BrightDataAdapter } from './adapters/brightdata'
import { OxylabsAdapter } from './adapters/oxylabs'
import { CustomGatewayAdapter } from './adapters/custom'
import { getCatalogEntry, listCatalog } from './catalog'

/**
 * Phase 20 — Proxy Provider Marketplace orchestrator
 *
 * Singleton that owns the registry of provider adapters, dispatches IPC
 * actions to the right adapter, and persists accounts (with encrypted
 * credentials) through the Database singleton.
 */
class ProxyProviderManager {
  private adapters: Record<ProxyProviderType, ProviderAdapter>

  constructor() {
    this.adapters = {
      smartproxy: new SmartproxyAdapter(),
      brightdata: new BrightDataAdapter(),
      oxylabs: new OxylabsAdapter(),
      custom: new CustomGatewayAdapter(),
    }
  }

  // ── Catalog ────────────────────────────────────────────────────────────────

  listCatalog() {
    return listCatalog()
  }

  // ── Account CRUD ───────────────────────────────────────────────────────────

  listAccounts(): ProxyProviderAccountView[] {
    const db = Database.getInstance()
    const rows = db.getAllProxyProviders()
    return rows.map((row) => this.rowToView(row))
  }

  createAccount(input: {
    type: ProxyProviderType
    label: string
    endpoint?: string
    port?: number
    defaultPool?: ProxyProviderAccount['defaultPool']
    defaultSession?: ProxyProviderAccount['defaultSession']
    credentials: ProxyProviderCredentialsInput
  }): ProxyProviderAccountView {
    const catalog = getCatalogEntry(input.type)
    if (!catalog) throw new Error(`Unknown provider type: ${input.type}`)

    const id = uuidv4()
    const now = new Date().toISOString()
    const account: ProxyProviderAccount = {
      id,
      type: input.type,
      label: input.label,
      endpoint: input.endpoint || catalog.defaultEndpoint,
      port: input.port || catalog.defaultPort,
      defaultPool: input.defaultPool ?? 'residential',
      defaultSession: input.defaultSession ?? 'rotating',
      status: 'unverified',
      lastTestedAt: null,
      lastError: null,
      usage: null,
      createdAt: now,
      updatedAt: now,
    }

    const db = Database.getInstance()
    db.createProxyProvider(account, input.credentials)
    return this.rowToView(db.getProxyProvider(id))
  }

  updateAccount(
    id: string,
    patch: Partial<{
      label: string
      endpoint: string
      port: number
      defaultPool: ProxyProviderAccount['defaultPool']
      defaultSession: ProxyProviderAccount['defaultSession']
      credentials: ProxyProviderCredentialsInput
    }>,
  ): ProxyProviderAccountView {
    const db = Database.getInstance()
    const existing = db.getProxyProvider(id)
    if (!existing) throw new Error(`Provider account ${id} not found`)
    db.updateProxyProvider(id, patch)
    return this.rowToView(db.getProxyProvider(id))
  }

  deleteAccount(id: string): void {
    const db = Database.getInstance()
    db.deleteProxyProvider(id)
  }

  // ── Adapter actions ────────────────────────────────────────────────────────

  async testAccount(id: string): Promise<ProxyProviderTestResult> {
    const { account, credentials } = this.loadWithCreds(id)
    const adapter = this.adapters[account.type]
    const result = await adapter.test(account, credentials)

    const db = Database.getInstance()
    db.updateProxyProviderStatus(id, {
      status: result.ok ? 'active' : 'invalid',
      lastError: result.ok ? null : (result.error ?? 'unknown error'),
      lastTestedAt: new Date().toISOString(),
    })
    return result
  }

  async refreshUsage(id: string): Promise<ProxyProviderUsage | null> {
    const { account, credentials } = this.loadWithCreds(id)
    const catalog = getCatalogEntry(account.type)
    if (!catalog.hasUsageApi) return null

    const adapter = this.adapters[account.type]
    const usage = await adapter.fetchUsage(account, credentials)

    if (usage) {
      Database.getInstance().updateProxyProviderUsage(id, usage)
    }
    return usage
  }

  async generateProxies(
    id: string,
    options: ProxyGenerationOptions,
  ): Promise<GeneratedProxy[]> {
    const { account, credentials } = this.loadWithCreds(id)
    const adapter = this.adapters[account.type]
    return adapter.generateProxies(account, credentials, options)
  }

  /**
   * Generate proxies AND persist them into the local proxies table so they
   * appear in the Proxy Manager and can be assigned to profiles immediately.
   * Returns the number of rows imported.
   */
  async generateAndImport(
    id: string,
    options: ProxyGenerationOptions,
  ): Promise<{ imported: number; proxies: GeneratedProxy[] }> {
    const generated = await this.generateProxies(id, options)
    const db = Database.getInstance()
    let imported = 0
    for (const proxy of generated) {
      try {
        db.createProxy({
          id: uuidv4(),
          name: proxy.name,
          type: proxy.type,
          host: proxy.host,
          port: proxy.port,
          username: proxy.username,
          password: proxy.password,
          country: proxy.country,
        })
        imported++
      } catch (err) {
        console.error('[ProxyProviderManager] Failed to import proxy:', err)
      }
    }
    return { imported, proxies: generated }
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private loadWithCreds(id: string): {
    account: ProxyProviderAccount
    credentials: ProxyProviderCredentialsInput
  } {
    const db = Database.getInstance()
    const row = db.getProxyProvider(id)
    if (!row) throw new Error(`Provider account ${id} not found`)
    const credentials = db.getProxyProviderCredentials(id)
    if (!credentials) throw new Error(`Credentials missing for account ${id}`)
    return { account: this.rowToAccount(row), credentials }
  }

  private rowToAccount(row: any): ProxyProviderAccount {
    return {
      id: row.id,
      type: row.type,
      label: row.label,
      endpoint: row.endpoint,
      port: row.port,
      defaultPool: row.default_pool ?? 'residential',
      defaultSession: row.default_session ?? 'rotating',
      status: row.status ?? 'unverified',
      lastTestedAt: row.last_tested_at ?? null,
      lastError: row.last_error ?? null,
      usage: row.usage_json ? safeParse(row.usage_json) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private rowToView(row: any): ProxyProviderAccountView {
    const account = this.rowToAccount(row)
    return {
      ...account,
      hasCredentials: Boolean(row.username_enc),
      hasApiKey: Boolean(row.api_key_enc),
      catalog: getCatalogEntry(account.type),
    }
  }
}

function safeParse(json: string): any {
  try { return JSON.parse(json) } catch { return null }
}

let singleton: ProxyProviderManager | null = null

export function getProxyProviderManager(): ProxyProviderManager {
  if (!singleton) singleton = new ProxyProviderManager()
  return singleton
}
