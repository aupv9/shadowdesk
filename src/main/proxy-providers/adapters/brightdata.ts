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
 * Phase 20 — Bright Data adapter
 *
 * BrightData uses zone-based credentials with username format:
 *
 *   brd-customer-<customer_id>-zone-<zone>-country-<cc>-session-<sid>
 *
 * https://docs.brightdata.com/proxy-networks/residential/quickstart
 *
 * Customer ID + zone are entered in `credentials.username` (the user can
 * paste the full prefix as it appears in their dashboard) and the zone field
 * may be supplied separately. The zone column lets us reuse one set of
 * credentials across multiple zones from the same customer.
 *
 * REST usage API:
 *   GET https://api.brightdata.com/zone/statistics?zone=<zone>
 *   Authorization: Bearer <api_key>
 */
export class BrightDataAdapter implements ProviderAdapter {
  private buildUsername(
    baseUsername: string,
    zone: string | undefined,
    options: { country?: string; session?: string; region?: string },
  ): string {
    // If the user already pasted a fully-qualified `brd-customer-...-zone-...`
    // string we leave it alone. Otherwise we splice the zone in.
    let head = baseUsername
    if (zone && !head.includes(`-zone-${zone}`) && !head.includes('-zone-')) {
      head = `${head}-zone-${zone}`
    }
    const parts = [head]
    if (options.country) parts.push('country', options.country.toLowerCase())
    if (options.region) parts.push('city', options.region.toLowerCase())
    if (options.session) parts.push('session', options.session)
    return parts.join('-')
  }

  async test(
    account: ProxyProviderAccount,
    credentials: ProxyProviderCredentialsInput,
  ): Promise<ProxyProviderTestResult> {
    try {
      const username = this.buildUsername(credentials.username, credentials.zone, {
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
    if (!credentials.apiKey || !credentials.zone) return null
    try {
      const { status, data } = await httpGetJson(
        `https://api.brightdata.com/zone/statistics?zone=${encodeURIComponent(credentials.zone)}`,
        { Authorization: `Bearer ${credentials.apiKey}` },
      )
      if (status !== 200 || typeof data !== 'object' || data === null) return null
      const obj = data as Record<string, unknown>
      const usedBytes = Number(obj['bytes'] ?? obj['traffic_used'] ?? 0)
      return {
        bandwidthGbUsed: usedBytes ? usedBytes / 1024 ** 3 : undefined,
        requestsTotal: typeof obj['requests'] === 'number' ? (obj['requests'] as number) : undefined,
        planName: credentials.zone,
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
      const username = this.buildUsername(credentials.username, credentials.zone, {
        country: options.country,
        region: options.region,
        session: sessionId,
      })
      const labelParts = ['BrightData']
      if (credentials.zone) labelParts.push(credentials.zone)
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
