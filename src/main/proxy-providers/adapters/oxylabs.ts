import type {
  GeneratedProxy,
  ProxyGenerationOptions,
  ProxyProviderAccount,
  ProxyProviderCredentialsInput,
  ProxyProviderTestResult,
  ProxyProviderUsage,
} from '../../../shared/types'
import { ProviderAdapter, PROXY_TEST_URL, randomSessionId } from '../base-adapter'
import { httpGetJson, httpGetViaProxy } from '../http-via-proxy'

/**
 * Phase 20 — Oxylabs adapter
 *
 * Oxylabs Residential Proxy uses customer:password auth on a fixed gateway
 * with country / city / sticky-session encoded in the username:
 *
 *   customer-USER-cc-VN-sessid-abc123-sesstime-10
 *
 * https://developers.oxylabs.io/scraper-apis/getting-started
 *
 * Usage stats live at:
 *   GET https://data.oxylabs.io/v1/stats?type=residential
 *   Authorization: Basic base64(user:password)
 */
export class OxylabsAdapter implements ProviderAdapter {
  private buildUsername(
    baseUsername: string,
    options: { country?: string; session?: string; region?: string; stickyMinutes?: number },
  ): string {
    const head = baseUsername.startsWith('customer-')
      ? baseUsername
      : `customer-${baseUsername}`
    const parts = [head]
    if (options.country) parts.push('cc', options.country.toUpperCase())
    if (options.region) parts.push('city', options.region.toLowerCase())
    if (options.session) parts.push('sessid', options.session)
    if (options.stickyMinutes && options.stickyMinutes > 0) {
      parts.push('sesstime', String(options.stickyMinutes))
    }
    return parts.join('-')
  }

  async test(
    account: ProxyProviderAccount,
    credentials: ProxyProviderCredentialsInput,
  ): Promise<ProxyProviderTestResult> {
    try {
      const username = this.buildUsername(credentials.username, {
        session: randomSessionId(),
      })
      const response = await httpGetViaProxy(
        account.endpoint,
        account.port,
        username,
        credentials.password,
        PROXY_TEST_URL,
      )
      if (response.status !== 200) {
        return {
          ok: false,
          latencyMs: response.latencyMs,
          error: `Proxy returned HTTP ${response.status}`,
        }
      }
      let exitIp: string | undefined
      try {
        const parsed = JSON.parse(response.body) as { query?: string }
        exitIp = parsed.query
      } catch { /* ignore */ }
      return { ok: true, latencyMs: response.latencyMs, exitIp }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  async fetchUsage(
    _account: ProxyProviderAccount,
    credentials: ProxyProviderCredentialsInput,
  ): Promise<ProxyProviderUsage | null> {
    try {
      const basic = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')
      const { status, data } = await httpGetJson(
        'https://data.oxylabs.io/v1/stats?type=residential',
        { Authorization: `Basic ${basic}` },
      )
      if (status !== 200 || typeof data !== 'object' || data === null) return null
      const obj = data as Record<string, unknown>
      const usedGb = Number(obj['traffic'] ?? obj['used_gb'] ?? 0)
      const totalGb = Number(obj['traffic_limit'] ?? obj['limit_gb'] ?? 0)
      return {
        bandwidthGbUsed: usedGb || undefined,
        bandwidthGbTotal: totalGb || undefined,
        planName: typeof obj['plan'] === 'string' ? (obj['plan'] as string) : undefined,
        refreshedAt: new Date().toISOString(),
      }
    } catch {
      return null
    }
  }

  async generateProxies(
    account: ProxyProviderAccount,
    credentials: ProxyProviderCredentialsInput,
    options: ProxyGenerationOptions,
  ): Promise<GeneratedProxy[]> {
    const session = options.session ?? account.defaultSession
    const proxies: GeneratedProxy[] = []
    for (let i = 0; i < options.count; i++) {
      const sessionId = session === 'sticky' ? randomSessionId() : undefined
      const username = this.buildUsername(credentials.username, {
        country: options.country,
        region: options.region,
        session: sessionId,
        stickyMinutes: session === 'sticky' ? (options.stickyMinutes ?? 10) : undefined,
      })
      const labelParts = ['Oxylabs']
      if (options.country) labelParts.push(options.country.toUpperCase())
      labelParts.push(session === 'sticky' ? `sticky-${sessionId}` : `rot-${i + 1}`)
      proxies.push({
        name: labelParts.join(' · '),
        type: 'http',
        host: account.endpoint,
        port: account.port,
        username,
        password: credentials.password,
        country: options.country,
        providerAccountId: account.id,
      })
    }
    return proxies
  }
}
