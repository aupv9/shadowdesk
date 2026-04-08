import { request as httpRequest } from 'http'
import { URL } from 'url'
import { PROVIDER_REQUEST_TIMEOUT_MS } from './base-adapter'

/**
 * Phase 20 — Proxy Provider Marketplace
 *
 * Tiny dependency-free HTTP-through-proxy client used by adapters to
 * validate credentials. Only supports plain HTTP target URLs (which is fine
 * for our test endpoint http://ip-api.com/json).
 *
 * Implementation: open a TCP connection to the proxy, send an absolute-URI
 * GET request with Proxy-Authorization, parse the JSON response. Avoids
 * pulling https-proxy-agent / undici-agents into the dependency tree.
 */
export interface ProxyHttpResponse {
  status: number
  body: string
  latencyMs: number
}

export async function httpGetViaProxy(
  proxyHost: string,
  proxyPort: number,
  proxyUsername: string,
  proxyPassword: string,
  targetUrl: string,
  timeoutMs: number = PROVIDER_REQUEST_TIMEOUT_MS,
): Promise<ProxyHttpResponse> {
  const parsed = new URL(targetUrl)
  if (parsed.protocol !== 'http:') {
    throw new Error('httpGetViaProxy only supports http:// targets')
  }

  const auth = Buffer.from(`${proxyUsername}:${proxyPassword}`).toString('base64')
  const start = Date.now()

  return new Promise((resolve, reject) => {
    const req = httpRequest({
      host: proxyHost,
      port: proxyPort,
      method: 'GET',
      // Absolute-form request URI is the standard way to talk through a
      // forward HTTP proxy — RFC 7230 §5.3.2.
      path: targetUrl,
      headers: {
        Host: parsed.host,
        'Proxy-Authorization': `Basic ${auth}`,
        'User-Agent': 'GhostBrowser/0.2 ProxyProviderProbe',
        Accept: 'application/json',
        Connection: 'close',
      },
      timeout: timeoutMs,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8')
        resolve({
          status: res.statusCode ?? 0,
          body,
          latencyMs: Date.now() - start,
        })
      })
      res.on('error', reject)
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy(new Error(`Proxy request timed out after ${timeoutMs}ms`))
    })
    req.end()
  })
}

/**
 * Plain JSON GET (no proxy). Used by adapters that hit a provider's REST
 * dashboard API for usage / quota information.
 */
export async function httpGetJson(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs: number = PROVIDER_REQUEST_TIMEOUT_MS,
): Promise<{ status: number; data: unknown }> {
  // Use Node 20+ built-in fetch with AbortController for timeout.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
      signal: controller.signal,
    })
    const text = await response.text()
    let data: unknown = text
    try { data = JSON.parse(text) } catch { /* keep raw */ }
    return { status: response.status, data }
  } finally {
    clearTimeout(timer)
  }
}
