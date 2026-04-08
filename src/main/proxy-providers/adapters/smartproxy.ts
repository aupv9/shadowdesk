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
 * Phase 20 — Smartproxy adapter
 *
 * Smartproxy uses username:password authentication on a fixed gateway. Geo
 * targeting and sticky sessions are encoded *into the username* using
 * dash-separated parameters:
 *
 *   user-country-vn-session-abc123
 *
 * https://help.smartproxy.com/docs/integration-guides
 *
 * Usage stats are exposed via the dashboard API at
 *   https://api.smartproxy.com/v1/users/<user>/sub-users  (requires API key)
 */
export class SmartproxyAdapter implements ProviderAdapter {
  /**
   * Build the auth username for a single request including geo + session
   * targeting parameters. The base username comes straight from the user.
   */
  private buildUsername(
    baseUsername: string,
    options: { country?: string; session?: string; region?: string; stickyMinutes?: number },
  ): string {
    const parts = [baseUsername]
    if (options.country) parts.push('country', options.country.toLowerCase())
    if (options.region) parts.push('city', options.region.toLowerCase())
    if (options.session) parts.push('session', options.session)
    if (options.stickyMinutes && options.stickyMinutes > 0) {
      parts.push('sessionduration', String(options.stickyMinutes))
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
      } catch { /* tolerate non-JSON */ }
      return { ok: true, latencyMs: response.latencyMs, exitIp }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  async fetchUsage(
    _account: ProxyProviderAccount,
    credentials: ProxyProviderCredentialsInput,
  ): Promise<ProxyProviderUsage | null> {
    if (!credentials.apiKey) return null
    try {
      const { status, data } = await httpGetJson(
        'https://api.smartproxy.com/v1/account/sub-users/usage',
        { Authorization: `Bearer ${credentials.apiKey}` },
      )
      if (status !== 200 || typeof data !== 'object' || data === null) return null
      const obj = data as Record<string, unknown>
      const usedBytes = Number(obj['traffic_used_bytes'] ?? obj['used_bytes'] ?? 0)
      const totalBytes = Number(obj['traffic_limit_bytes'] ?? obj['limit_bytes'] ?? 0)
      return {
        bandwidthGbUsed: usedBytes ? usedBytes / 1024 ** 3 : undefined,
        bandwidthGbTotal: totalBytes ? totalBytes / 1024 ** 3 : undefined,
        planName: typeof obj['plan_name'] === 'string' ? (obj['plan_name'] as string) : undefined,
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
      const labelParts = ['Smartproxy']
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
