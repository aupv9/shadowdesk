import type {
  GeneratedProxy,
  ProxyGenerationOptions,
  ProxyProviderAccount,
  ProxyProviderCredentialsInput,
  ProxyProviderTestResult,
  ProxyProviderUsage,
} from '../../shared/types'

/**
 * Phase 20 — Proxy Provider Marketplace
 * (User-facing label: "Phase 17 — Proxy API Integration")
 *
 * Common interface every concrete provider adapter implements. The manager
 * dispatches user actions to the right adapter based on `account.type`.
 *
 * Adapters are stateless — credentials are passed in for every operation so
 * we can keep secrets out of long-lived memory and reuse the adapter across
 * accounts of the same type.
 */
export interface ProviderAdapter {
  /** Verify credentials by making a single live request through the gateway. */
  test(
    account: ProxyProviderAccount,
    credentials: ProxyProviderCredentialsInput,
  ): Promise<ProxyProviderTestResult>

  /**
   * Fetch usage statistics from the provider's REST API. Returns null if the
   * provider does not expose a usage endpoint or the API key is missing.
   */
  fetchUsage(
    account: ProxyProviderAccount,
    credentials: ProxyProviderCredentialsInput,
  ): Promise<ProxyProviderUsage | null>

  /**
   * Generate N proxy entries from the provider's gateway according to the
   * options (country, pool, sticky vs rotating, etc). The returned entries
   * are suitable for inserting into the local `proxies` table verbatim.
   */
  generateProxies(
    account: ProxyProviderAccount,
    credentials: ProxyProviderCredentialsInput,
    options: ProxyGenerationOptions,
  ): Promise<GeneratedProxy[]>
}

/** Test endpoint used by every adapter — small JSON response, low latency. */
export const PROXY_TEST_URL = 'http://ip-api.com/json'

/** Default request timeout when talking to provider gateways / APIs. */
export const PROVIDER_REQUEST_TIMEOUT_MS = 12_000

/**
 * Build an HTTP proxy URL string from the supplied credentials. Used by all
 * adapters when issuing the test request via Node's `https-proxy-agent`.
 */
export function buildProxyUrl(
  endpoint: string,
  port: number,
  username: string,
  password: string,
): string {
  const safeUser = encodeURIComponent(username)
  const safePass = encodeURIComponent(password)
  return `http://${safeUser}:${safePass}@${endpoint}:${port}`
}

/**
 * Generate a random sticky-session token. Most providers accept any short
 * alphanumeric value here — they hash it internally to map to an exit IP.
 */
export function randomSessionId(length = 10): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}
