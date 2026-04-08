import type {
  GeneratedProxy,
  ProxyGenerationOptions,
  ProxyProviderAccount,
  ProxyProviderCredentialsInput,
  ProxyProviderTestResult,
  ProxyProviderUsage,
} from '../../../shared/types'
import { ProviderAdapter, PROXY_TEST_URL, randomSessionId } from '../base-adapter'
import { httpGetViaProxy } from '../http-via-proxy'

/**
 * Phase 20 — Custom gateway adapter
 *
 * Generic fallback for any provider that exposes plain username:password
 * authentication on a fixed gateway. Country / session targeting is left to
 * the user (we don't munge the username at all).
 */
export class CustomGatewayAdapter implements ProviderAdapter {
  async test(
    account: ProxyProviderAccount,
    credentials: ProxyProviderCredentialsInput,
  ): Promise<ProxyProviderTestResult> {
    try {
      const response = await httpGetViaProxy(
        account.endpoint,
        account.port,
        credentials.username,
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

  async fetchUsage(): Promise<ProxyProviderUsage | null> {
    // Custom gateways have no standard usage API.
    return null
  }

  async generateProxies(
    account: ProxyProviderAccount,
    credentials: ProxyProviderCredentialsInput,
    options: ProxyGenerationOptions,
  ): Promise<GeneratedProxy[]> {
    const proxies: GeneratedProxy[] = []
    for (let i = 0; i < options.count; i++) {
      const sessionId = randomSessionId(6)
      proxies.push({
        name: `Custom · ${sessionId}`,
        type: 'http',
        host: account.endpoint,
        port: account.port,
        username: credentials.username,
        password: credentials.password,
        country: options.country,
        providerAccountId: account.id,
      })
    }
    return proxies
  }
}
